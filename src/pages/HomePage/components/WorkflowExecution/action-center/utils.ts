import { QuickTask, Task, TaskFilters } from './types';

export const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-slate-700',
  'bg-indigo-500',
  'bg-blue-400',
  'bg-emerald-500',
  'bg-green-600',
  'bg-orange-500',
  'bg-purple-500',
] as const;

export function generateTaskId(tasks: Task[], quickTasks: QuickTask[]): string {
  const numbers = [...tasks, ...quickTasks].map((t) => {
    const match = t.id.match(/PIP-(\d+)/i);
    return match ? parseInt(match[1], 10) : 0;
  });
  const next = Math.max(0, ...numbers, 0) + 1;
  return `PIP-${next}`;
}

export function pickAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function matchesSearch(query: string, ...fields: (string | undefined)[]): boolean {
  if (!query.trim()) return true;
  const normalized = query.trim().toLowerCase();
  return fields.some((field) => field?.toLowerCase().includes(normalized));
}

export function filterKanbanTasks(tasks: Task[], search: string, filters: TaskFilters): Task[] {
  return tasks.filter((task) => {
    if (
      !matchesSearch(
        search,
        task.id,
        task.title,
        task.assignee.initials,
        task.description,
      )
    ) {
      return false;
    }
    if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) {
      return false;
    }
    if (filters.assignees.length > 0 && !filters.assignees.includes(task.assignee.initials)) {
      return false;
    }
    if (filters.overdueOnly && !task.isOverdue) {
      return false;
    }
    return true;
  });
}

export function filterQuickTasks(
  quickTasks: QuickTask[],
  search: string,
  filters: TaskFilters,
): QuickTask[] {
  return quickTasks.filter((task) => {
    if (!matchesSearch(search, task.id, task.title, task.assignee.initials)) {
      return false;
    }
    if (filters.quickCategories.length > 0 && !filters.quickCategories.includes(task.category)) {
      return false;
    }
    if (filters.assignees.length > 0 && !filters.assignees.includes(task.assignee.initials)) {
      return false;
    }
    if (filters.overdueOnly && !task.isOverdue) {
      return false;
    }
    return true;
  });
}

export function getUniqueAssignees(tasks: Task[], quickTasks: QuickTask[]): string[] {
  const set = new Set<string>();
  tasks.forEach((t) => set.add(t.assignee.initials));
  quickTasks.forEach((t) => set.add(t.assignee.initials));
  return Array.from(set).sort();
}

export function hasActiveFilters(filters: TaskFilters): boolean {
  return (
    filters.statuses.length > 0 ||
    filters.assignees.length > 0 ||
    filters.overdueOnly ||
    filters.quickCategories.length > 0
  );
}
