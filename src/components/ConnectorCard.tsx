import React from 'react';
import { Pen, Trash2, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

type Props = {
  title?: string;
  connectionLabel?: string;
  database?: string;
  schema?: string;
  table?: string;
  iconSrc?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  variant?: 'saved' | 'sample';
  showFooterButtons?: boolean;
  onEditRow?: () => void;
  onDeleteRow?: () => void;
  /** When true, card shows only the connector icon (minimal / placeholder) */
  iconOnly?: boolean;
  /** Optional custom icon element for iconOnly mode (e.g. Plus icon) */
  icon?: React.ReactNode;
};

const ConnectorCard: React.FC<Props> = ({
  title,
  connectionLabel,
  database,
  schema,
  table,
  iconSrc,
  onEdit,
  onDelete,
  variant = 'saved',
  showFooterButtons = false,
  onEditRow,
  onDeleteRow,
  iconOnly = false,
  icon,
}) => {
  const handleEdit = onEditRow ?? onEdit;
  const handleDelete = onDeleteRow ?? onDelete;
  const themeAccentBg = 'bg-primary/10 dark:bg-primary/20';
  const themeAccentText = 'text-primary';
  const themeAccentBorder = 'border-black/10 dark:border-primary/30';

  if (iconOnly) {
    return (
      <div className="group block pb-1">
        <div
          className={`
            relative w-full min-w-0 rounded-xl bg-card p-4
            shadow-md transition-all duration-300 ease-out
            group-hover:-translate-y-1 group-hover:shadow-lg group-hover:ring-1 group-hover:ring-primary/20
            ${themeAccentBorder}
          `}
        >
        <div className={`flex aspect-square w-full items-center justify-center rounded-none border border-border ${themeAccentBg}`}>
          {icon ?? (iconSrc ? (
            <img src={iconSrc} alt="" className="h-8 w-8 object-contain" aria-hidden />
          ) : (
            <span className="text-2xl"></span>
          ))}
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group block pb-1">
      <div
        className={`
          relative w-full min-w-0 max-w-full cursor-pointer overflow-hidden rounded-xl
          border border-black bg-card p-3 text-card-foreground
          shadow-md transition-all duration-300 ease-out
          group-hover:-translate-y-1 group-hover:shadow-xl group-hover:ring-1 group-hover:ring-primary/25
          ${themeAccentBorder}
        `}
      >
      <div className="relative z-10 flex items-start gap-2.5 pb-1">
        <div >
          {iconSrc ? (
            <img src={iconSrc} alt="" className="h-8 w-8 object-contain" aria-hidden />
          ) : (
            <span className="text-xl">🐘</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className={`text-[9px] font-medium uppercase tracking-widest opacity-90 ${themeAccentText}`}>
            Dataset
          </div>
          <div className="truncate text-sm font-extrabold tracking-tight text-card-foreground" title={title}>
            {title || 'Unnamed source'}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          {(handleEdit || handleDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className={`
                    flex h-6 w-6 items-center justify-center rounded-md border border-border
                    transition-all hover:scale-105 hover:bg-muted active:scale-95
                    ${themeAccentBg} ${themeAccentText}
                  `}
                  aria-label="Actions"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {handleEdit && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit && handleEdit();
                    }}
                    className='text-primary focus:text-primary data-[state=open]:bg-primary/10'
                  >
                    <Pen className="mr-2 h-4 w-4 text-primary" /> Edit
                  </DropdownMenuItem>
                )}
                {handleDelete && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete && handleDelete();
                    }}
                    className="text-red-500 focus:text-red-600 data-[state=open]:bg-red-100"
                  >
                    <Trash2 className="mr-2 h-4 w-4 text-red-400" /> Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      <div className="relative z-10 mb-3 h-px bg-gradient-to-r from-border to-transparent" />
      <div className="relative z-10 grid grid-cols-2 gap-x-3 gap-y-1.5 pb-3">
        <div>
          <div className="text-[8.5px] uppercase tracking-wider text-muted-foreground">Connection</div>
          <div className="text-[11px] font-medium text-foreground">{connectionLabel || '—'}</div>
        </div>
        <div>
          <div className="text-[8.5px] uppercase tracking-wider text-muted-foreground">Database</div>
          <div className="text-[11px] font-medium text-foreground">{database || '—'}</div>
        </div>
        <div>
          <div className="text-[8.5px] uppercase tracking-wider text-muted-foreground">Schema</div>
          <div className="text-[11px] font-medium text-foreground">{schema || '—'}</div>
        </div>
        <div>
          <div className="text-[8.5px] uppercase tracking-wider text-muted-foreground">Table</div>
          <div className={`text-[11px] font-medium ${themeAccentText}`}>{table || '—'}</div>
        </div>
      </div>
    </div>
    </div>
  );
};

export default ConnectorCard;
