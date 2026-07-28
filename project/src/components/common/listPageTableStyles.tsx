/** Shared layout for Roles/Users-style list pages with TableWithPagination. */
export const LIST_PAGE_CARD_CLASS = "gap-0 border-border/70 p-0 shadow-sm";

export const LIST_PAGE_CARD_HEADER_CLASS =
  "border-b border-border/60 px-2 py-1.5 [.border-b]:pb-0";

export const LIST_PAGE_CARD_TITLE_CLASS = "shrink-0 text-[16px] font-semibold";

export const LIST_PAGE_TABLE_WRAPPER_CLASS =
  "[&_table]:text-xs [&_th]:h-8 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-xs [&_th]:font-semibold [&_th]:normal-case [&_th]:tracking-wider [&_td]:py-1.5";

export function SearchClearButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded p-0.5 text-white bg-destructive hover:bg-destructive"
      aria-label="Clear search"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );
}
