export type TaskStatus = 'pending' | 'unmatched' | 'matched' | 'total';

export type QuickTaskCategory = 'open' | 'completed' | 'accepted';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  assignee: {
    initials: string;
    color: string;
  };
  timeAgo: string;
  progress: number;
  isOverdue?: boolean;
  overdueTime?: string;
  tag?: string;
}

export interface QuickTask {
  id: string;
  title: string;
  category: QuickTaskCategory;
  assignee: {
    initials: string;
    color: string;
  };
  timeAgo: string;
  isOverdue?: boolean;
  overdueTime?: string;
  isCompleted?: boolean;
}

export interface ColumnType {
  id: TaskStatus;
  title: string;
  count: number;
}

export interface TaskFilters {
  statuses: TaskStatus[];
  assignees: string[];
  overdueOnly: boolean;
  quickCategories: QuickTaskCategory[];
}

export const DEFAULT_TASK_FILTERS: TaskFilters = {
  statuses: [],
  assignees: [],
  overdueOnly: false,
  quickCategories: [],
};

export type AddTaskTarget =
  | { type: 'kanban'; status: TaskStatus }
  | { type: 'quick'; category: QuickTaskCategory };
