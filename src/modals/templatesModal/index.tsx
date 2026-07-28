import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { Button } from "@/components/ui/button";
import { SidebarProvider } from "@/components/ui/flow-sidebar";
import { useCustomNavigate } from "@/customization/hooks/use-custom-navigate";
import { track } from "@/customization/utils/analytics";
// import useAddFlow from "@/hooks/flows/use-add-flow";
import type { Category } from "@/types/templates";
import { useState, type JSX } from "react";
import type { newFlowModalPropsType } from "../../types/components";
import BaseModal from "@/modals/baseModal";
// import GetStartedComponent from "./components/GetStartedComponent";
// import TemplateContentComponent from "./components/TemplateContentComponent";
import { Nav } from "./components/navComponent";
import { useIdStore } from "@/stores/idStore";
// import useAddFlow from "@/hooks/use-add-flow";

export default function TemplatesModal({
  open,
  setOpen,
}: newFlowModalPropsType): JSX.Element {
  const [currentTab, setCurrentTab] = useState("get-started");
  const navigate = useCustomNavigate();
  // const addFlow = useAddFlow();

  const { generateId } = useIdStore()
  const id = generateId()

  // Define categories and their items
  const categories: Category[] = [
    {
      title: "Templates",
      items: [
        { title: "Get started", icon: "SquarePlay", id: "get-started" },
        { title: "All templates", icon: "LayoutPanelTop", id: "all-templates" },
      ],
    },
    {
      title: "Use Cases",
      items: [
        { title: "Assistants", icon: "BotMessageSquare", id: "assistants" },
        { title: "Classification", icon: "Tags", id: "classification" },
        { title: "Coding", icon: "TerminalIcon", id: "coding" },
        {
          title: "Content Generation",
          icon: "Newspaper",
          id: "content-generation",
        },
        { title: "Q&A", icon: "Database", id: "q-a" },
        // { title: "Summarization", icon: "Bot", id: "summarization" },
        // { title: "Web Scraping", icon: "CodeXml", id: "web-scraping" },
      ],
    },
    {
      title: "Methodology",
      items: [
        { title: "Prompting", icon: "MessagesSquare", id: "chatbots" },
        { title: "RAG", icon: "Database", id: "rag" },
        { title: "Agents", icon: "Bot", id: "agents" },
      ],
    },
  ];

  const featureCards = [
    {
      title: "Data Reconciliation",
      name:"Reconciliation",
      description: "Compare and reconcile data across multiple sources to ensure consistency and accuracy",
      icon: "FileDiff",
      gradient: "bg-linear-to-r from-[#3641537a] via-[#6a728276] to-[#d1d5dc73]"
    },
    {
      title: "Data Validation",
      name:"Validation",
      description: "Validate data integrity and quality with comprehensive checks and automated rules",
      icon: "ClipboardCheck",
      gradient: "bg-linear-to-r from-[#3641537a] via-[#6a728276] to-[#d1d5dc73]"
    },
    {
      title: "Data Masking",
      name:"Masking",
      description: "Protect sensitive information with advanced data masking and anonymization techniques",
      icon: "FileLock2",
      gradient: "bg-linear-to-r from-[#3641537a] via-[#6a728276] to-[#d1d5dc73]"
    }
  ];

  const handleCardClick = (cardTitle: string) => {
    track("Feature Card Clicked", { feature: cardTitle });
    // Navigate or perform action based on card
  };

  const handleKeyDown = (event: React.KeyboardEvent, cardTitle: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleCardClick(cardTitle);
    }
  };

  return (
    <BaseModal size="templates" open={open} setOpen={setOpen} className="p-0">
      <BaseModal.Content overflowHidden className="flex flex-col p-0">
        <div className="flex h-full">
          <SidebarProvider width="15rem" defaultOpen={false}>
            <Nav
              categories={categories}
              currentTab={currentTab}
              setCurrentTab={setCurrentTab}
            />
            <main className="flex flex-1 flex-col gap-4 overflow-hidden p-6 md:gap-8">
              {currentTab === "get-started" ? (
                // <GetStartedComponent />
                <>
                  <div className="space-y-6">
                    <div className="flex flex-col items-start justify-center">
                      <div className="text-2xl font-semibold">Featured Templates</div>
                      <div className="text-sm text-muted-foreground">
                        Explore our most popular data processing workflows.
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {featureCards.map((card) => (
                        <div
                          key={card.title}
                          className="group relative flex h-[25rem] w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border/50 bg-card transition-all duration-300 hover:border-border focus-visible:border-ring"
                          tabIndex={0}
                          onKeyDown={(e) => handleKeyDown(e, card.title)}
                          onClick={() => {
                            // addFlow().then((flowData: any) => {
                            //   navigate(
                            //     `/dashboard/flow/${id}`,
                            //   );
                            // });
                            track("New Flow Created", { template: "Blank Flow" });
                          }} >
                          <div className={`absolute inset-2 h-[calc(100%-16px)] w-[calc(100%-16px)] overflow-hidden rounded-xl bg-gradient-to-br ${card.gradient} opacity-90`} />
                          
                          <div className="card-shine-effect absolute inset-2 flex h-[calc(100%-16px)] w-[calc(100%-16px)] flex-col items-start gap-3 rounded-xl p-4 text-primary">
                            <div className="flex items-center gap-2 text-primary">
                              <ForwardedIconComponent name={card.icon} className="h-6 w-6" />
                              <span className="font-mono text-xs font-semibold uppercase tracking-wider">
                                {card.name}
                              </span>
                            </div>
                            
                            <div className="flex w-full items-start justify-between">
                              <h3 className="text-lg font-bold leading-tight">
                                {card.title}
                              </h3>
                              <ForwardedIconComponent
                                name="ArrowRight"
                                className="h-6 w-6 shrink-0 translate-x-0 opacity-0 transition-all duration-300 group-hover:translate-x-2 group-hover:opacity-100 group-focus-visible:translate-x-2 group-focus-visible:opacity-100"
                              />
                            </div>

                            <p className="line-clamp-3 w-full overflow-hidden text-sm font-light text-primary leading-relaxed">
                              {card.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                // <TemplateContentComponent
                //   currentTab={currentTab}
                //   categories={categories.flatMap((category) => category.items)}
                // />
                <>
                </>
              )}
              <BaseModal.Footer>
                <div className="flex w-full flex-col justify-between gap-4 pb-4 sm:flex-row sm:items-center">
                  <div className="flex flex-col items-start justify-center">
                    <div className="font-semibold">Start from scratch</div>
                    <div className="text-sm text-muted-foreground">
                      Begin with a fresh flow to build from scratch.
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      // addFlow().then((flowData: any) => {
                      //   navigate(
                      //     `/dashboard/flow/${id}`,
                      //   );
                      // });
                      track("New Flow Created", { template: "Blank Flow" });
                    }}
                    size="sm"
                    data-testid="blank-flow"
                    className="shrink-0"
                  >
                    <ForwardedIconComponent
                      name="Plus"
                      className="h-4 w-4 shrink-0"
                    />
                    Blank Flow
                  </Button>
                </div>
              </BaseModal.Footer>
            </main>
          </SidebarProvider>
        </div>
      </BaseModal.Content>
    </BaseModal>
  );
}