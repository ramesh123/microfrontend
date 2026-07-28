import { SidebarHeaderComponent } from "./components/sidebarHeader";
import { SidebarFooterComponent } from "./components/sidebarFooter";
import type { JSX } from "react";
import { useSidebarStore } from "@/stores/sidebarStore";
import SkeletonGroup from "@/components/ui/skeletonGroup";
import { useEffect, useMemo, useState } from "react";
import { useTypesStore } from "@/stores/typesStore";
import { CategoryGroup } from "./components/categoryGroup";
import { MemoizedSidebarGroup } from "./components/sidebarBundles";
import { NodeCategories, NodeItem } from "./types";

const CATEGORIES = [];

interface FlowSidebarComponentProps {
  isLoading: boolean;
}

export default function FlowSidebarComponent({ isLoading: parentIsLoading }: FlowSidebarComponentProps): JSX.Element {

  const isCollapsed = useSidebarStore((state) => state.isCollapsed)

  // Get the data in your component
  const { data, error, fetchNodes, isLoading } = useTypesStore();

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  const [openCategories, setOpenCategories] = useState<string[]>([]);

  useEffect(() => {
    if (data) {
      // Initialize dataFilter with the fetched data
      setFilterData(data);
      if (data.data) {
        setOpenCategories(Object.keys(data.data));
      }
    }
  }, [data]);

  const [dataFilter, setFilterData] = useState(null);

  const hasBundleItems = useMemo(() => {
    if (!dataFilter?.data) return false;
    return Object.values(dataFilter.data).flat().some((item) => Object.keys(item).length > 0);
  }, [dataFilter]);

  // Check loading state but don't return early
  const isLoadingState = parentIsLoading || isLoading;

  return (
    <>
      <div
        className={`h-full bg-background transition-all duration-200 ease-in-out ${isCollapsed ? "w-0" : "w-64 border-r"
          }`}
      >
        { !isCollapsed && (
          <>
            <div className="flex h-full w-full flex-col">
              <div className="border-b">
                <SidebarHeaderComponent />
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden">
                  {isLoadingState ? (
                    <SkeletonGroup />
                  ) : dataFilter?.data ? (
                    <CategoryGroup 
                      item={dataFilter.data}
                      openCategories={openCategories} 
                      setOpenCategories={setOpenCategories}
                    > 
                      {hasBundleItems && (
                        <MemoizedSidebarGroup 
                          items={dataFilter.data} 
                          openCategories={openCategories} 
                          setOpenCategories={setOpenCategories} 
                        />
                      )}
                    </CategoryGroup>
                  ) : (
                    <div className="flex flex-col gap-2 p-3">
                      <p className="text-center text-sm text-muted-foreground">
                        No data available
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="border-t">
                <SidebarFooterComponent />
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
