
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, ChevronRight, LayoutGrid } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion'
import SchemaScanStep from './SchemaScanStep';
import ContextStep from './ContextStep';
import EntityMapping from './EntityMapping';
import Hierarchy from './Hierarchy';
import Metrics from './Metrics';
import DimsFacts from './DimsAndFacts';
import Readiness from './Readiness';
import TenantLanding from './TenantLanding';
import { useSemanticsStore } from '@/stores/semanticsStore';

const steps = [
  { id: 1, name: 'Schema' },
  { id: 2, name: 'Context' },
  { id: 3, name: 'Entity Mapping' },
  { id: 4, name: 'Hierarchy' },
  { id: 5, name: 'Dims & Facts' },
  { id: 6, name: 'Metrics' },
  { id: 7, name: 'Readiness' },
];

type View = 'landing' | 'wizard';

export default function SemanticsStepper({ current = 1, onStepClick }: { current?: number; onStepClick?: (n: number) => void }) {
  const [view, setView] = useState<View>('landing');
  const [active, setActive] = useState<number>(current);
  const [reached, setReached] = useState<number>(current);
  const [dir, setDir] = useState<number>(1);

  const { loadExistingTenant, tenantDisplayName, tenantId, isConfigView } = useSemanticsStore();

  useEffect(() => {
    setActive(current);
    setReached(prev => Math.max(prev, current));
  }, [current]);

  const goTo = (n: number) => {
    const isGoingBack = n < active;
    setDir(isGoingBack ? -1 : 1);

    // Cache is preserved when navigating - no invalidation on back navigation.
    // Components check for cached data and only fetch if not already loaded.
    if (!isGoingBack) {
      setReached(prev => Math.max(prev, n));
    }

    setActive(n);
    if (onStepClick) onStepClick(n);
  };

  const handleSelectTenant = (selectedTenantId: string, displayName: string) => {
    loadExistingTenant(selectedTenantId, displayName);
    setActive(1);
    // In config view (existing tenant), unlock all steps immediately
    setReached(steps.length);
    setDir(1);
    setView('wizard');
  };

  const handleCreateNew = () => {
    // resetStore is called after creation succeeds, then handleSelectTenant
    // is called with the new tenant's ID — no extra reset needed here.
  };

  const handleBackToTenants = () => {
    setView('landing');
    setActive(1);
    setReached(1);
    setDir(1);
  };

  // --- Landing view ---
  if (view === 'landing') {
    return (
      <TenantLanding
        onSelectTenant={handleSelectTenant}
        onCreateNew={handleCreateNew}
      />
    );
  }

  // --- Wizard view ---
  return (
    <div className="flex flex-col h-full w-full">
      {/* Stepper Header */}
      <div className="w-full border-b bg-background">
        <nav className="flex items-center w-full">
          {/* Back to tenants / back step button */}
          <button
            type="button"
            onClick={() => {
              if (active === 1) {
                handleBackToTenants();
              } else {
                goTo(Math.max(1, active - 1));
              }
            }}
            className="w-9 h-9 flex items-center justify-center shrink-0 ml-2"
            aria-label={active === 1 ? 'Back to tenants' : 'Back'}
            title={active === 1 ? 'Back to tenants' : 'Previous step'}
          >
            {active === 1 ? <LayoutGrid className="h-4 w-4" /> : <ArrowLeft className="h-5 w-5" />}
          </button>

          {/* Tenant name indicator */}
          {tenantDisplayName && (
            <div className="flex items-center gap-1.5 px-2 mr-1 border-r border-border/50">
              <span className="text-[11px] font-medium text-muted-foreground truncate max-w-[100px]" title={`${tenantDisplayName} (${tenantId})`}>
                {tenantDisplayName}
              </span>
            </div>
          )}

          {steps.map((step, index) => {
            const stepIndex = index + 1;
            const isActive = stepIndex === active;
            const isDone = isConfigView ? (stepIndex !== active) : (stepIndex < active);
            const isReached = isConfigView ? true : (stepIndex <= reached);
            const isClickable = isReached && !isActive;
            return (
              <React.Fragment key={step.id}>
                <button
                  type="button"
                  onClick={() => isClickable && goTo(stepIndex)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 whitespace-nowrap transition-colors ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${isDone ? 'bg-primary text-white' : isActive ? 'bg-primary text-white' : isReached ? 'bg-primary/20 border border-primary text-primary' : 'bg-white border border-slate-200 text-muted-foreground'}`}>
                    {isDone ? <Check className="h-3.5 w-3.5" /> : stepIndex}
                  </div>
                  <span className={`text-xs font-medium ${isActive ? 'text-foreground' : isDone ? 'text-foreground/90' : isReached ? 'text-foreground/80' : 'text-muted-foreground'}`}>{step.name}</span>
                </button>
                {index < steps.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* Step Content */}
      <div className="flex-1 w-full overflow-auto">
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={active}
            custom={dir}
            variants={{
              initial: (d: number) => ({ opacity: 0, x: 40 * d, scale: 0.995 }),
              animate: { opacity: 1, x: 0, scale: 1, transition: { duration: 0.28 } },
              exit: (d: number) => ({ opacity: 0, x: -40 * d, scale: 0.995, transition: { duration: 0.22 } }),
            }}
            initial="initial"
            animate="animate"
            exit="exit"
            className="w-full h-full"
          >
            {active === 1 && <SchemaScanStep onNext={() => goTo(2)} />}
            {active === 2 && <ContextStep onNext={() => goTo(3)} />}
            {active === 3 && <EntityMapping onNext={() => goTo(4)} />}
            {active === 4 && <Hierarchy onNext={() => goTo(5)} />}
            {active === 5 && <DimsFacts onNext={() => goTo(6)} />}
            {active === 6 && <Metrics onNext={() => goTo(7)} />}
            {active === 7 && <Readiness />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

