import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import DatasetStepLoading from "@/components/common/datasets/DatasetStepLoading";
import { getChartPreviewIcon } from "@/pages/charts/components/ChartPreviewIcons";
import { getChartPreviewImage } from "../chartPreviewImages";
import { CHART_TYPE_OPTIONS } from "../chartTypeCatalog";
import { getChartSectionLabel, getChartSectionShortLabel, sortChartSections } from "../chartSectionLabels";
import type { ChartCategoryId } from "../chartTypeCatalog";
import type { DashboardChartComponent, DashboardChartSection } from "@/pages/Visualization/API/chartsApi";

interface ChartTypeStepProps {
  sections: DashboardChartSection[];
  isLoading: boolean;
  error?: string | null;
  selectedChartTypeId?: string;
  onSelectChartType: (chartTypeId: string) => void;
  isViewOnly?: boolean;
  filterCategory?: ChartCategoryId;
}

function formatChartLabel(name: string) {
  return name.replace(/chart$/i, "").trim() || name;
}

function normalizeChartKey(value: string) {
  return value.toLowerCase().replace(/[\s-]+/g, "_").replace(/_chart$/i, "");
}

function getCatalogSortIndex(component: DashboardChartComponent) {
  const match = findCatalogMatch(component);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return CHART_TYPE_OPTIONS.indexOf(match);
}

function sortComponents(components: DashboardChartComponent[]) {
  return [...components].sort((left, right) => getCatalogSortIndex(left) - getCatalogSortIndex(right));
}

function normalizeSectionKey(section: string) {
  return section.toLowerCase().trim().replace(/[\s-]+/g, "_");
}

function sectionMatchesCategory(sectionKey: string, category: ChartCategoryId) {
  const normalized = normalizeSectionKey(sectionKey);
  if (normalized === category) return true;

  if (category === "charts") {
    return [
      "charts",
      "comparison",
      "evolution",
      "part_of_a_whole",
      "distribution",
      "relationship",
      "ranking",
      "geospatial",
    ].includes(normalized);
  }

  if (category === "kpi_gauges") {
    return ["kpi_gauges", "kpi"].includes(normalized);
  }

  if (category === "tables") {
    return ["tables", "table"].includes(normalized);
  }

  if (category === "ot_process") {
    return ["ot_process", "timeseries"].includes(normalized);
  }

  return false;
}

function componentMatchesCategory(component: DashboardChartComponent, category: ChartCategoryId) {
  const lookupKey = normalizeChartKey(component.key || component.unique_id || component.name);
  const catalogMatch = CHART_TYPE_OPTIONS.find((option) => {
    const optionKey = normalizeChartKey(option.id);
    return (
      optionKey === lookupKey ||
      lookupKey.includes(optionKey) ||
      optionKey.includes(lookupKey)
    );
  });

  return catalogMatch?.category === category;
}

function findCatalogMatch(component: DashboardChartComponent) {
  const lookupKey = normalizeChartKey(component.key || component.unique_id || component.name);
  return CHART_TYPE_OPTIONS.find((option) => {
    const optionKey = normalizeChartKey(option.id);
    return (
      optionKey === lookupKey ||
      lookupKey.includes(optionKey) ||
      optionKey.includes(lookupKey)
    );
  });
}

function getChartDescription(component: DashboardChartComponent) {
  const catalogMatch = findCatalogMatch(component);

  if (catalogMatch?.description) {
    return catalogMatch.description;
  }

  if (component.tags?.length) {
    return component.tags.slice(0, 2).join(" · ");
  }

  return component.key?.replace(/_/g, " ") || "Visualize your data";
}

function componentMatchesSearch(component: DashboardChartComponent, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const label = formatChartLabel(component.name).toLowerCase();
  const description = getChartDescription(component).toLowerCase();
  const key = (component.key || "").toLowerCase();

  return (
    label.includes(normalizedQuery) ||
    description.includes(normalizedQuery) ||
    key.includes(normalizedQuery)
  );
}

function isNarrowPreviewChart(component: DashboardChartComponent) {
  const lookupKey = normalizeChartKey(component.key || component.unique_id || component.name);
  const nameKey = normalizeChartKey(component.name);

  return (
    /funnel/.test(lookupKey) ||
    /funnel/.test(nameKey) ||
    /^(table|pivot_table)$/.test(lookupKey) ||
    /^(table|pivot_table)$/.test(nameKey) ||
    /\btable\b/.test(nameKey)
  );
}

function isShorterPreviewChart(component: DashboardChartComponent) {
  const lookupKey = normalizeChartKey(component.key || component.unique_id || component.name);
  const nameKey = normalizeChartKey(component.name);

  return (
    /stack|stacked/.test(lookupKey) ||
    /stacked/.test(nameKey) ||
    /sunburst/.test(lookupKey) ||
    /sunburst/.test(nameKey) ||
    /^line$/.test(lookupKey) ||
    /\bline\b/.test(nameKey) ||
    /area/.test(lookupKey) ||
    /area/.test(nameKey) ||
    /pie/.test(lookupKey) ||
    /pie/.test(nameKey)
  );
}

function ChartTypeCard({
  component,
  isSelected,
  onSelect,
  cardRef,
}: {
  component: DashboardChartComponent;
  isSelected: boolean;
  onSelect: () => void;
  cardRef: (node: HTMLButtonElement | null) => void;
}) {
  const previewKey = (component.unique_id || component.key || component.name).toLowerCase();
  const previewImage = getChartPreviewImage(previewKey, component.name);
  const PreviewIcon = previewImage ? null : getChartPreviewIcon(previewKey, component.name);
  const label = formatChartLabel(component.name);
  const description = getChartDescription(component);
  const narrowPreview = isNarrowPreviewChart(component);
  const shorterPreview = isShorterPreviewChart(component);

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={onSelect}
      title={`${label} — ${description}`}
      data-chart-type-id={component.unique_id}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-background text-left transition-all duration-200",
        "shadow-[0_2px_10px_rgba(15,23,42,0.08)]",
        "hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_8px_24px_rgba(15,23,42,0.12)]",
        isSelected
          ? "border-primary bg-primary/[0.04] shadow-[0_6px_20px_rgba(37,99,235,0.18)] ring-2 ring-primary/25"
          : "border-border/60",
      )}
    >
      <div
        className={cn(
          "relative flex h-[3.75rem] items-center justify-center px-1.5 py-1 transition-colors sm:h-16",
          isSelected
            ? "bg-gradient-to-b from-primary/15 to-primary/5"
            : "bg-gradient-to-b from-muted/70 to-muted/20 group-hover:from-primary/10 group-hover:to-primary/5",
        )}
      >
        {isSelected ? (
          <span className="absolute right-2 top-2 z-10 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <Check className="size-3" strokeWidth={3} />
          </span>
        ) : (
          <span className="absolute right-2 top-2 z-10 size-5 rounded-full border-2 border-border/60 bg-background/80 opacity-0 transition-opacity group-hover:opacity-100" />
        )}

        {previewImage ? (
          <img
            src={previewImage}
            alt=""
            aria-hidden
            className={cn(
              "max-h-full max-w-full object-contain transition-transform duration-200",
              narrowPreview
                ? shorterPreview
                  ? "h-[2.25rem] w-[2rem] sm:h-[2.5rem] sm:w-[2.25rem]"
                  : "h-[2.75rem] w-[2rem] sm:h-[3rem] sm:w-[2.25rem]"
                : shorterPreview
                  ? "h-[2.25rem] w-[2.75rem] sm:h-[2.5rem] sm:w-[2.5rem]"
                  : "h-[2.75rem] w-[2.75rem] sm:h-[3rem] sm:w-[3rem]",
              "group-hover:scale-[1.03]",
              isSelected && "scale-[1.03]",
            )}
          />
        ) : PreviewIcon ? (
          <PreviewIcon
            className={cn(
              "shrink-0 text-primary transition-transform duration-200",
              "size-8 sm:size-8",
              "group-hover:scale-[1.03]",
              isSelected && "scale-[1.03]",
            )}
          />
        ) : (
          <span className="text-sm font-bold uppercase text-primary">{label.slice(0, 2)}</span>
        )}
      </div>

      <div className="px-2 py-1.5">
        <p
          className={cn(
            "line-clamp-1 text-center text-[11px] font-semibold leading-tight",
            isSelected ? "text-primary" : "text-foreground",
          )}
        >
          {label}
        </p>
      </div>
    </button>
  );
}

export default function ChartTypeStep({
  sections,
  isLoading,
  error,
  selectedChartTypeId,
  onSelectChartType,
  isViewOnly = false,
  filterCategory,
}: ChartTypeStepProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const hasScrolledToSelection = useRef(false);

  const visibleSections = useMemo(() => {
    const populated = sections
      .map((section) => ({
        ...section,
        components: filterCategory
          ? section.components.filter(
            (component) =>
              sectionMatchesCategory(section.section, filterCategory) ||
              componentMatchesCategory(component, filterCategory),
          )
          : section.components,
      }))
      .filter((section) => section.components.length > 0);

    return sortChartSections(populated);
  }, [filterCategory, sections]);

  const [activeSection, setActiveSection] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return visibleSections;

    return visibleSections
      .map((section) => ({
        ...section,
        components: section.components.filter((component) =>
          componentMatchesSearch(component, searchQuery),
        ),
      }))
      .filter((section) => section.components.length > 0);
  }, [searchQuery, visibleSections]);

  const scrollToSection = useCallback((sectionKey: string) => {
    setActiveSection(sectionKey);
    sectionRefs.current.get(sectionKey)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const scrollToChart = useCallback((chartTypeId: string, behavior: ScrollBehavior = "smooth") => {
    cardRefs.current.get(chartTypeId)?.scrollIntoView({
      behavior,
      block: "center",
    });
  }, []);

  useEffect(() => {
    if (visibleSections.length === 0) return;

    if (selectedChartTypeId) {
      const owner = visibleSections.find((section) =>
        section.components.some((component) => component.unique_id === selectedChartTypeId),
      );
      if (owner) {
        setActiveSection(owner.section);
        return;
      }
    }

    if (!activeSection || !visibleSections.some((section) => section.section === activeSection)) {
      setActiveSection(visibleSections[0].section);
    }
  }, [activeSection, selectedChartTypeId, visibleSections]);

  useEffect(() => {
    if (filteredSections.length === 0) return;

    if (!filteredSections.some((section) => section.section === activeSection)) {
      setActiveSection(filteredSections[0].section);
    }
  }, [activeSection, filteredSections]);

  useEffect(() => {
    if (!selectedChartTypeId || filteredSections.length === 0) return;

    const frame = window.requestAnimationFrame(() => {
      scrollToChart(selectedChartTypeId, hasScrolledToSelection.current ? "smooth" : "auto");
      hasScrolledToSelection.current = true;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [filteredSections, scrollToChart, selectedChartTypeId]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || filteredSections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio);

        const topSection = visible[0]?.target.getAttribute("data-section-key");
        if (topSection) {
          setActiveSection(topSection);
        }
      },
      {
        root: container,
        rootMargin: "-20% 0px -55% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    sectionRefs.current.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [filteredSections]);

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/10">
        <DatasetStepLoading message="Loading chart types..." size="lg" />
      </div>
    );
  }

  if (error || visibleSections.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/10 p-4 text-center">
        <p className="text-sm text-muted-foreground">{error ?? "No chart types available."}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-background mt-1">
      <aside className="flex w-48 shrink-0 flex-col border-r bg-muted/40 sm:w-52">
        <div className="border-b px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Categories
          </p>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search chart types..."
              className="h-8 border-border/60 bg-muted/30 pl-8 pr-8 text-xs"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-3" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
            {visibleSections.map((section) => {
              const isActive = section.section === activeSection;
              const isDimmed =
                searchQuery.trim().length > 0 &&
                !filteredSections.some((item) => item.section === section.section);

              return (
                <button
                  key={section.section}
                  type="button"
                  onClick={() => scrollToSection(section.section)}
                  title={getChartSectionLabel(section.section)}
                  className={cn(
                    "relative mb-1 flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition-all",
                    isActive
                      ? "bg-primary/12 text-primary shadow-[0_2px_8px_rgba(37,99,235,0.12)]"
                      : "text-foreground hover:bg-muted/70",
                    isDimmed && "opacity-40",
                  )}
                >
                  {isActive ? (
                    <span
                      className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-primary"
                      aria-hidden
                    />
                  ) : null}

                  <span className="truncate text-xs font-bold uppercase">
                    {getChartSectionShortLabel(section.section)}
                  </span>
                  <Badge
                    variant={isActive ? "default" : "secondary"}
                    className="h-5 shrink-0 rounded-full px-2 text-[10px] font-semibold"
                  >
                    {section.components.length}
                  </Badge>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-muted/50">
          <div
            ref={scrollContainerRef}
            className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4"
          >
            {filteredSections.length === 0 ? (
              <div className="flex h-full min-h-[16rem] flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-background/80 p-8 text-center shadow-sm backdrop-blur-sm">
                <Search className="mb-3 size-9 text-muted-foreground/40" />
                <p className="text-sm font-semibold text-foreground">No chart types found</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Try a different search term, or{" "}
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    clear the search
                  </button>
                  .
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {filteredSections.map((section) => (
                  <section
                    key={section.section}
                    ref={(node) => {
                      if (node) sectionRefs.current.set(section.section, node);
                      else sectionRefs.current.delete(section.section);
                    }}
                    data-section-key={section.section}
                    // className="scroll-mt-3 rounded-xl border border-border/60 bg-background/90 p-2 pl-3 shadow-[0_2px_12px_rgba(15,23,42,0.06)] backdrop-blur-sm sm:px-3 sm:py-2"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className="h-5 w-1 rounded-full bg-primary" aria-hidden />
                      <h3 className="text-xs font-bold uppercase text-foreground">
                        {getChartSectionLabel(section.section)}
                      </h3>
                      <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px]">
                        {section.components.length} types
                      </Badge>
                    </div>

                    <div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))]">
                      {sortComponents(section.components).map((component) => (
                        <ChartTypeCard
                          key={component.unique_id}
                          component={component}
                          isSelected={selectedChartTypeId === component.unique_id}
                          onSelect={() => {
                            if (isViewOnly) return;
                            onSelectChartType(component.unique_id);
                            scrollToChart(component.unique_id);
                          }}
                          cardRef={(node) => {
                            if (node) cardRefs.current.set(component.unique_id, node);
                            else cardRefs.current.delete(component.unique_id);
                          }}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
    </div>
  );
}
