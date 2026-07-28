import custom from "../customization/config-constants";

export const DEFAULT_FOLDER = "Starter Project";
export const DEFAULT_FOLDER_DEPRECATED = "My Projects";
export const BASE_URL_API = custom.BASE_URL_API || "/api/";
export const DRAG_EVENTS_CUSTOM_TYPESS = {
  genericnode: "genericNode",
  notenode: "noteNode",
  "text/plain": "text/plain",
};
export const defaultShortcuts = [
  {
    display_name: "Controls",
    name: "Advanced Settings",
    shortcut: "mod+shift+a",
  },
  {
    display_name: "Search Components on Sidebar",
    name: "Search Components Sidebar",
    shortcut: "/",
  },
  {
    display_name: "Minimize",
    name: "Minimize",
    shortcut: "mod+.",
  },
  {
    display_name: "Code",
    name: "Code",
    shortcut: "space",
  },
  {
    display_name: "Copy",
    name: "Copy",
    shortcut: "mod+c",
  },
  {
    display_name: "Duplicate",
    name: "Duplicate",
    shortcut: "mod+d",
  },
  {
    display_name: "Component Share",
    name: "Component Share",
    shortcut: "mod+shift+s",
  },
  {
    display_name: "Docs",
    name: "Docs",
    shortcut: "mod+shift+d",
  },
  {
    display_name: "Changes Save",
    name: "Changes Save",
    shortcut: "mod+s",
  },
  {
    display_name: "Save Component",
    name: "Save Component",
    shortcut: "mod+alt+s",
  },
  {
    display_name: "Delete",
    name: "Delete",
    shortcut: "backspace",
  },
  {
    display_name: "Open Playground",
    name: "Open Playground",
    shortcut: "mod+k",
  },
  {
    display_name: "Undo",
    name: "Undo",
    shortcut: "mod+z",
  },
  {
    display_name: "Redo",
    name: "Redo",
    shortcut: "mod+y",
  },
  {
    display_name: "Redo (alternative)",
    name: "Redo Alt",
    shortcut: "mod+shift+z",
  },
  {
    display_name: "Group",
    name: "Group",
    shortcut: "mod+g",
  },
  {
    display_name: "Cut",
    name: "Cut",
    shortcut: "mod+x",
  },
  {
    display_name: "Paste",
    name: "Paste",
    shortcut: "mod+v",
  },
  {
    display_name: "API",
    name: "API",
    shortcut: "r",
  },
  {
    display_name: "Download",
    name: "Download",
    shortcut: "mod+j",
  },
  {
    display_name: "Update",
    name: "Update",
    shortcut: "mod+u",
  },
  {
    display_name: "Freeze",
    name: "Freeze Path",
    shortcut: "mod+shift+f",
  },
  {
    display_name: "Flow Share",
    name: "Flow Share",
    shortcut: "mod+shift+b",
  },
  {
    display_name: "Play",
    name: "Play",
    shortcut: "p",
  },
  {
    display_name: "Output Inspection",
    name: "Output Inspection",
    shortcut: "o",
  },
  {
    display_name: "Tool Mode",
    name: "Tool Mode",
    shortcut: "mod+shift+m",
  },
  {
    display_name: "Toggle Sidebar",
    name: "Toggle Sidebar",
    shortcut: "mod+b",
  },
];

export const MAPPING_COLORS = [
  'border-l-blue-400', 'border-l-green-400', 'border-l-purple-400', 'border-l-orange-400', 'border-l-pink-400',
  'border-l-cyan-400', 'border-l-yellow-400', 'border-l-indigo-400', 'border-l-teal-400', 'border-l-rose-400'
];

export const HOVER_BG_COLORS = [
  'bg-blue-50 dark:bg-blue-950/30', 'bg-green-50 dark:bg-green-950/30', 'bg-purple-50 dark:bg-purple-950/30',
  'bg-orange-50 dark:bg-orange-950/30', 'bg-pink-50 dark:bg-pink-950/30', 'bg-cyan-50 dark:bg-cyan-950/30',
  'bg-yellow-50 dark:bg-yellow-950/30', 'bg-indigo-50 dark:bg-indigo-950/30', 'bg-teal-50 dark:bg-teal-950/30',
  'bg-rose-50 dark:bg-rose-950/30'

];
export const PILL_COLORS = [
  { bg: 'bg-rose-100 dark:bg-rose-900/50', border: 'border-l-rose-400', svg: '#fb7185' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/50', border: 'border-l-emerald-400', svg: '#34d399' },
  { bg: 'bg-sky-100 dark:bg-sky-900/50', border: 'border-l-sky-400', svg: '#38bdf8' },
  { bg: 'bg-amber-100 dark:bg-amber-900/50', border: 'border-l-amber-400', svg: '#f59e0b' },
  { bg: 'bg-violet-100 dark:bg-violet-900/50', border: 'border-l-violet-400', svg: '#8b5cf6' },
  { bg: 'bg-pink-100 dark:bg-pink-900/50', border: 'border-l-pink-400', svg: '#f472b6' },
  { bg: 'bg-teal-100 dark:bg-teal-900/50', border: 'border-l-teal-400', svg: '#2dd4bf' },
  { bg: 'bg-orange-100 dark:bg-orange-900/50', border: 'border-l-orange-400', svg: '#f97316' },
  { bg: 'bg-lime-100 dark:bg-lime-900/50', border: 'border-l-lime-400', svg: '#a3e635' },
  { bg: 'bg-cyan-100 dark:bg-cyan-900/50', border: 'border-l-cyan-400', svg: '#22d3ee' },
];
