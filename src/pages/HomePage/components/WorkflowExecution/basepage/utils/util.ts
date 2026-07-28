// utils/modalUtils.ts
export type TabType = "performance" | "runcycle" | "exceptioncount" | "feedbacks";

export interface ExpandedContentProps {
  tab: TabType;
  onClose: () => void;
}

// Helper to get title based on active tab
export const getTabTitle = (tab: TabType) => {
  switch (tab) {
    case "performance":
      return "Team Performance";
    case "runcycle":
      return "Run Cycle Performance";
    case "exceptioncount":
      return "Exception Count Distribution";
    case "feedbacks":
      return "Team Feedbacks";
    default:
      return "";
  }
};
