import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';

import { Button } from '@/components/ui/button';
import { Search, MoreHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Task, TaskStatus, QuickTask, AddTaskTarget, DEFAULT_TASK_FILTERS } from './types';
import { initialColumns, initialTasks, initialQuickTasks } from './mock';
import { Column } from './column';
import { QuickTasks } from './quicktask';
import { TaskCard } from './Taskcard';
import { AddTaskDialog } from './AddTaskDialog';
import { TaskFilterPopover } from './TaskFilterPopover';
import {
  filterKanbanTasks,
  filterQuickTasks,
  generateTaskId,
  getUniqueAssignees,
  pickAvatarColor,
} from './utils';

export default function Actions() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [quickTasks, setQuickTasks] = useState<QuickTask[]>(initialQuickTasks);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState(DEFAULT_TASK_FILTERS);
  const [addTarget, setAddTarget] = useState<AddTaskTarget | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const assignees = useMemo(
    () => getUniqueAssignees(tasks, quickTasks),
    [tasks, quickTasks],
  );

  const filteredKanbanTasks = useMemo(
    () => filterKanbanTasks(tasks, searchQuery, filters),
    [tasks, searchQuery, filters],
  );

  const filteredQuickTasks = useMemo(
    () => filterQuickTasks(quickTasks, searchQuery, filters),
    [quickTasks, searchQuery, filters],
  );

  const getTasksByStatus = (status: TaskStatus) =>
    filteredKanbanTasks.filter((task) => task.status === status);

  const findColumn = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    return task ? task.status : null;
  };

  const openAddDialog = (target: AddTaskTarget) => {
    setAddTarget(target);
    setAddDialogOpen(true);
  };

  const handleAddTask = (data: {
    title: string;
    assigneeInitials: string;
    isOverdue: boolean;
    overdueTime?: string;
  }) => {
    if (!addTarget) return;

    const id = generateTaskId(tasks, quickTasks);
    const assignee = {
      initials: data.assigneeInitials,
      color: pickAvatarColor(data.assigneeInitials),
    };

    if (addTarget.type === 'quick') {
      const newQuickTask: QuickTask = {
        id,
        title: data.title,
        category: addTarget.category,
        assignee,
        timeAgo: 'Just now',
        isOverdue: data.isOverdue,
        overdueTime: data.overdueTime,
        isCompleted: addTarget.category === 'completed',
      };
      setQuickTasks((prev) => [...prev, newQuickTask]);
    } else {
      const newTask: Task = {
        id,
        title: data.title,
        status: addTarget.status,
        assignee,
        timeAgo: 'Just now',
        progress: 0,
        isOverdue: data.isOverdue,
        overdueTime: data.overdueTime,
      };
      setTasks((prev) => [...prev, newTask]);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const activeColumn = findColumn(activeId);
    const overColumn = initialColumns.some((c) => c.id === overId)
      ? (overId as TaskStatus)
      : findColumn(overId);

    if (!activeColumn || !overColumn || activeColumn === overColumn) return;

    setTasks((prev) =>
      prev.map((t) => (t.id === activeId ? { ...t, status: overColumn } : t)),
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const activeId = active.id as string;
    const overId = over?.id as string;

    if (!over) {
      setActiveId(null);
      return;
    }

    const activeColumn = findColumn(activeId);
    const overColumn = initialColumns.some((c) => c.id === overId)
      ? (overId as TaskStatus)
      : findColumn(overId);

    if (activeColumn && overColumn && activeColumn === overColumn) {
      const columnTasks = tasks.filter((t) => t.status === activeColumn);
      const activeIndex = columnTasks.findIndex((t) => t.id === activeId);
      const overIndex = columnTasks.findIndex((t) => t.id === overId);

      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        setTasks((items) => {
          const from = items.findIndex((t) => t.id === activeId);
          const to = items.findIndex((t) => t.id === overId);
          return arrayMove(items, from, to);
        });
      }
    }

    setActiveId(null);
  };

  const handleResetBoard = () => {
    setTasks(initialTasks);
    setQuickTasks(initialQuickTasks);
    setSearchQuery('');
    setFilters(DEFAULT_TASK_FILTERS);
  };

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  return (
    <div className="flex flex-col h-full w-full bg-slate-100 overflow-hidden font-sans">
      <header className="bg-background flex items-center shrink-0 h-10 justify-between p-0">
        <span className="text-lg font-semibold">Actions</span>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-2 top-2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search..."
              className="pl-8 h-8 bg-background border-slate-200 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <TaskFilterPopover
            filters={filters}
            assignees={assignees}
            onChange={setFilters}
            onClear={() => setFilters(DEFAULT_TASK_FILTERS)}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSearchQuery('')}>
                Clear search
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilters(DEFAULT_TASK_FILTERS)}>
                Clear filters
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleResetBoard}>Reset board</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden bg-background min-h-0">
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex-1 overflow-auto w-full p-0 pt-1 min-h-0">
              <div className="flex gap-3 pb-4">
                <QuickTasks
                  tasks={filteredQuickTasks}
                  onAddTask={(category) => openAddDialog({ type: 'quick', category })}
                />

                {initialColumns.map((col) => (
                  <Column
                    key={col.id}
                    column={col}
                    tasks={getTasksByStatus(col.id)}
                    onAddTask={(status) => openAddDialog({ type: 'kanban', status })}
                  />
                ))}
              </div>
            </div>

            <DragOverlay>
              {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      <AddTaskDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        target={addTarget}
        onSubmit={handleAddTask}
      />
    </div>
  );
}
