import { create } from 'zustand';
import type { AppliedFormLogicState, FormBuilderDefinition } from '../types';

export interface DynamicFormAssignment {
  menuPath: string;
  menuTitle: string;
  definition: FormBuilderDefinition;
  appliedLogic: AppliedFormLogicState | null;
  savedAt: number;
  /** True when this assignment created a new sidebar entry (not overwrite). */
  createdMenuItem?: boolean;
}

export interface CreatedDynamicFormMenuItem {
  p_id: string;
  title: string;
  path: string;
  /** Parent menu path; empty/null = append as top-level item in sidebar. */
  parentPath?: string | null;
  icon?: string;
}

interface DynamicFormAssignmentState {
  assignmentsByPath: Record<string, DynamicFormAssignment>;
  createdMenuItems: CreatedDynamicFormMenuItem[];
  assignForm: (
    menuPath: string,
    menuTitle: string,
    definition: FormBuilderDefinition,
    appliedLogic: AppliedFormLogicState | null,
    options?: { createdMenuItem?: boolean },
  ) => void;
  addCreatedMenuItem: (item: CreatedDynamicFormMenuItem) => void;
  getAssignmentForPath: (pathname: string) => DynamicFormAssignment | undefined;
  clearAssignment: (menuPath: string) => void;
  listAssignments: () => DynamicFormAssignment[];
  listCreatedMenuItems: () => CreatedDynamicFormMenuItem[];
}

function normalizePath(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed) return '/';
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withSlash.replace(/\/$/, '') || '/';
}

export const useDynamicFormAssignmentStore = create<DynamicFormAssignmentState>((set, get) => ({
  assignmentsByPath: {},
  createdMenuItems: [],

  assignForm: (menuPath, menuTitle, definition, appliedLogic, options) => {
    const path = normalizePath(menuPath);
    set((state) => ({
      assignmentsByPath: {
        ...state.assignmentsByPath,
        [path]: {
          menuPath: path,
          menuTitle,
          definition,
          appliedLogic,
          savedAt: Date.now(),
          createdMenuItem: options?.createdMenuItem,
        },
      },
    }));
  },

  addCreatedMenuItem: (item) => {
    const path = normalizePath(item.path);
    set((state) => {
      const withoutDup = state.createdMenuItems.filter((entry) => entry.path !== path);
      return {
        createdMenuItems: [
          ...withoutDup,
          {
            ...item,
            path,
            parentPath: item.parentPath ? normalizePath(item.parentPath) : null,
          },
        ],
      };
    });
  },

  getAssignmentForPath: (pathname) => {
    const normalized = normalizePath(pathname);
    return get().assignmentsByPath[normalized] ?? get().assignmentsByPath[pathname];
  },

  clearAssignment: (menuPath) => {
    const path = normalizePath(menuPath);
    set((state) => {
      const next = { ...state.assignmentsByPath };
      delete next[path];
      return {
        assignmentsByPath: next,
        createdMenuItems: state.createdMenuItems.filter((item) => item.path !== path),
      };
    });
  },

  listAssignments: () => Object.values(get().assignmentsByPath),
  listCreatedMenuItems: () => get().createdMenuItems,
}));
