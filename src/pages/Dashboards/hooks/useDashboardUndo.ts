import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { DashboardChart } from '../types';

const MAX_HISTORY = 50;

interface DashboardUndoSnapshot {
  dashboardCharts: DashboardChart[];
  dashboardTitle: string;
}

function cloneDashboardCharts(charts: DashboardChart[]): DashboardChart[] {
  if (typeof structuredClone === 'function') {
    return structuredClone(charts);
  }
  return JSON.parse(JSON.stringify(charts)) as DashboardChart[];
}

function layoutSignature(charts: DashboardChart[]): string {
  return charts
    .map(
      (dc) =>
        `${dc.id}:${dc.chartId}:${dc.position.x},${dc.position.y}:${dc.size.width},${dc.size.height}`,
    )
    .join('|');
}

function snapshotsEqual(a: DashboardUndoSnapshot, b: DashboardUndoSnapshot): boolean {
  return a.dashboardTitle === b.dashboardTitle && layoutSignature(a.dashboardCharts) === layoutSignature(b.dashboardCharts);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return false;
  const input = target as HTMLInputElement;
  if (tag === 'INPUT' && input.placeholder === 'Enter dashboard title') return false;
  return true;
}

export function useDashboardUndo(
  dashboardCharts: DashboardChart[],
  setDashboardCharts: React.Dispatch<React.SetStateAction<DashboardChart[]>>,
  dashboardTitle: string,
  setDashboardTitle: React.Dispatch<React.SetStateAction<string>>,
  resetKey?: string | null,
) {
  const pastRef = useRef<DashboardUndoSnapshot[]>([]);
  const futureRef = useRef<DashboardUndoSnapshot[]>([]);
  const isRestoringRef = useRef(false);
  const [stackCounts, setStackCounts] = useState({ past: 0, future: 0 });
  const syncStackCounts = useCallback(
    () => setStackCounts({ past: pastRef.current.length, future: futureRef.current.length }),
    [],
  );

  const createSnapshot = useCallback((): DashboardUndoSnapshot => ({
    dashboardCharts: cloneDashboardCharts(dashboardCharts),
    dashboardTitle,
  }), [dashboardCharts, dashboardTitle]);

  const clearHistory = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    syncStackCounts();
  }, [syncStackCounts]);

  useEffect(() => {
    clearHistory();
  }, [resetKey, clearHistory]);

  const pushUndoSnapshot = useCallback(() => {
    if (isRestoringRef.current) return;

    const snap = createSnapshot();
    const past = pastRef.current;
    const last = past[past.length - 1];
    if (last && snapshotsEqual(last, snap)) return;

    past.push(snap);
    if (past.length > MAX_HISTORY) {
      past.shift();
    }
    futureRef.current = [];
    syncStackCounts();
  }, [createSnapshot, syncStackCounts]);

  const applySnapshot = useCallback(
    (snap: DashboardUndoSnapshot) => {
      isRestoringRef.current = true;
      setDashboardCharts(cloneDashboardCharts(snap.dashboardCharts));
      setDashboardTitle(snap.dashboardTitle);
      isRestoringRef.current = false;
      syncStackCounts();
    },
    [setDashboardCharts, setDashboardTitle, syncStackCounts],
  );

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) {
      toast.message('Nothing to undo');
      return;
    }

    const current = createSnapshot();
    futureRef.current.push(current);
    const previous = pastRef.current.pop()!;
    applySnapshot(previous);
    toast.success('Undone');
  }, [createSnapshot, applySnapshot]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) {
      toast.message('Nothing to redo');
      return;
    }

    const current = createSnapshot();
    pastRef.current.push(current);
    const next = futureRef.current.pop()!;
    applySnapshot(next);
    toast.success('Redone');
  }, [createSnapshot, applySnapshot]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      if (e.key === 'y' || (e.key === 'z' && e.shiftKey) || (e.key === 'Z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return {
    pushUndoSnapshot,
    undo,
    redo,
    canUndo: stackCounts.past > 0,
    canRedo: stackCounts.future > 0,
    clearHistory,
  };
}
