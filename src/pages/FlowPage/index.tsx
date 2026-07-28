import React, { type JSX } from 'react';
import PageComponent from './components/PageComponent';
import { useLocation, useParams } from 'react-router-dom';
import useFlowStore from '@/stores/flowStore';
import { NodeInspector } from './components/PageComponent/nodeInspector';
import { NodeLibrarySidebar } from './SideBar';
import { CollapsedSelectionProvider } from '@/components/CollapsedSelectionContext';
import { MessageCircle } from 'lucide-react';
import { AiChatDialog } from './Aichatbox';

export default function FlowPage(): JSX.Element {
  const { id: flowIdFromUrl } = useParams<{ id: string }>();
  const currentWorkflow = useFlowStore((state) => state.currentWorkflow);
  const setCurrentWorkflow = useFlowStore((state) => state.setCurrentWorkflow);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isInspectorOpen, setIsInspectorOpen] = React.useState(false);
  const location = useLocation();
  const mode = location.state?.mode === "view" ? "view" : "edit";
  // Open AI chat by default when opening a workflow (unless explicitly set to false)
  const [isAiOpen, setIsAiOpen] = React.useState(
    mode === "edit" && location.state?.openAiChat !== false
  );
  /** Briefly ignore node-sheet backdrop closes to avoid ghost clicks on the dimmer after ASK AI closes (same screen area). */
  const [suppressNodeSheetBackdropClose, setSuppressNodeSheetBackdropClose] = React.useState(false);

  const handleAiOpenChange = React.useCallback((open: boolean) => {
    setIsAiOpen(open);
    if (!open) {
      setSuppressNodeSheetBackdropClose(true);
      window.setTimeout(() => setSuppressNodeSheetBackdropClose(false), 400);
    }
  }, []);

  // virtualdb_mode is set by PageComponent when loading GET /virtual-dataset/:id or create flow API.
  // Do not patch virtualdb_mode onto an existing normal flow here — same route id + ?virtualdb=1 would skip fetch and show the wrong canvas.

  // Open AI chat by default when workflow loads (unless we just saved as draft)
  const skipOpenAiAfterSaveDraft = useFlowStore((state) => state.skipOpenAiAfterSaveDraft);
  const setSkipOpenAiAfterSaveDraft = useFlowStore((state) => state.setSkipOpenAiAfterSaveDraft);
  /** After clearing skipOpenAiAfterSaveDraft, deps re-run this effect; skip one auto-open so AI stays closed. */
  const suppressNextAutoOpenAiRef = React.useRef(false);
  React.useEffect(() => {
    if (skipOpenAiAfterSaveDraft) {
      setIsAiOpen(false);
      setSkipOpenAiAfterSaveDraft(false);
      suppressNextAutoOpenAiRef.current = true;
      return;
    }
    if (suppressNextAutoOpenAiRef.current) {
      suppressNextAutoOpenAiRef.current = false;
      return;
    }
    if (mode === "edit" && currentWorkflow?.id && location.state?.openAiChat !== false) {
      setIsAiOpen(true);
    }
  }, [mode, currentWorkflow?.id, location.state?.openAiChat, skipOpenAiAfterSaveDraft, setSkipOpenAiAfterSaveDraft]);

  


  // NOTE: The URL parameter 'flowIdFromUrl' is actually the database ID, not the flow_id UUID
  // The workflow's flow_id (UUID) is already set correctly from the API response
  // So we don't need to sync anything from the URL to the workflow

  React.useEffect(() => {
    setIsLoading(true)
    // Check if workflow data is loaded
    if (currentWorkflow && currentWorkflow.id) {
      // Workflow is loaded, stop loading after a brief moment to ensure rendering
      setTimeout(() => {
        setIsLoading(false)
      }, 500)
    } else {
      // If no workflow after 5 seconds, stop loading anyway
      setTimeout(() => {
        setIsLoading(false)
      }, 5000)
    }
  }, [currentWorkflow])

  // React.useEffect(() => {
  //   if (idParam) {
  //     setCurrentFlow({
  //       workflow_id: idParam,
  //       name: "New Flow",
  //       description: "New Flow",
  //       data: {
  //         nodes,
  //         edges,
  //         viewport: reactFlowInstance?.getViewport() ?? {
  //           zoom: 1,
  //           x: 0,
  //           y: 0,
  //         },
  //       },
  //       icon: "",
  //       icon_bg_color: "",
  //       gradient: "",
  //       locked: false,
  //       display_name: "New Flow",
  //       scheduler: {},
  //       assigned_user: [],
  //       assigned_role: [],
  //       workflow_type: "",
  //       flow_id: "",
  //       deployment_id: "",
  //       deployment_name: "",
  //     })
  //   }
  // }, [idParam])
  // if (isLoading) {
  //   return (
  //     <div className="w-full h-screen flex items-center justify-center bg-background">
  //       <Loader className="h-12 w-12 animate-spin text-primary" />
  //     </div>
  //   )
  // }
  return (
    <>
      <div className="h-full w-full overflow-hidden">
        <div className="flex h-full overflow-hidden">
          {/* <FlowSidebarComponent isLoading={isLoading} /> */}
          <CollapsedSelectionProvider>
            <NodeLibrarySidebar mode={mode} onAiClick={() => mode === "edit" && setIsAiOpen(true)} />
          </CollapsedSelectionProvider>
          <main className="flex w-full overflow-hidden">
            <div className="h-full w-full">
            <PageComponent
              mode={mode}
              onOpenAi={() => mode === "edit" && setIsAiOpen(true)}
              suppressNodeSheetBackdropClose={suppressNodeSheetBackdropClose}
            />
            </div>

            {/* <div className="fixed bottom-6 right-6 z-50 group">
              <button
                onClick={() => setIsAiOpen(true)}
                className="
                  flex items-center gap-0
                  h-14
                  w-14 group-hover:w-58
                  overflow-hidden
                  rounded-full
                  text-primary-foreground
                  shadow-lg
                  transition-all duration-300 ease-out
                  ai-float-animate
                  ai-gradient-bg
                "
                style={{ background: 'conic-gradient(from 0deg, #6366f1, #a21caf, #6366f1 100%)' }}
              > */}
                {/* Icon */}
                {/* <div className="flex h-14 w-14 items-center justify-center shrink-0">
                  <MessageCircle className="h-6 w-6" />
                </div> */}

                {/* Text */}
                {/* <span
                  className="
                    whitespace-nowrap text-sm font-medium
                    opacity-0 translate-x-2
                    group-hover:opacity-100 group-hover:translate-x-0
                    transition-all duration-300 delay-100
                  "
                >
                  Ask me about the flow!
                </span>
              </button>
            </div> */}

            {mode === "edit" && (
              <AiChatDialog 
                open={isAiOpen} 
                onOpenChange={handleAiOpenChange} 
                mode="PIPELINE"
                initialQuestion={location.state?.initialQuestion}
              />
            )}

            {/* Floating animation style */}
            {/* <style>{`
              @keyframes ai-float {
                0% { transform: translateY(0); }
                50% { transform: translateY(-18px); }
                100% { transform: translateY(0); }
              }
              .ai-float-animate {
                animation: ai-float 2.2s ease-in-out infinite;
              }
            `}</style> */}

          </main>
          <div className="relative">
            <NodeInspector
              isOpen={isInspectorOpen}
              onToggle={() => setIsInspectorOpen(prev => !prev)}
            />
          </div>
        </div>
      </div>
    </>
  );
};
