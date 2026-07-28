import React, {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";

type Size = "small" | "medium";
type Mode = "single" | "multiple";

interface Option {
    label: string | React.ReactNode;
    value: string;
    [key: string]: unknown;
}

interface DropdownV2Handle {
    getSelected: () => string;
}

type Props = {
    Disabled?: boolean;
    options?: Option[];
    mode?: Mode;
    value?: string;
    onChange?: (value: string, selected: Option[] | Option | null, option?: Option) => void;
ShowIcon?: boolean;
Icon?: React.ReactNode;
onSearch?: (q: string) => void;
placeholder?: string;
searchable?: boolean;
size?: Size;
};

const DropdownV2 = forwardRef<DropdownV2Handle, Props>(
    (
        {
            Disabled = false,
            options = [],
            mode = "single",
            value = "",
            onChange,
            ShowIcon = true,
            Icon = null,
            onSearch,
            placeholder = "select",
            searchable = true,
            size = "medium",
        }: Props,
        ref
    ) => {
        const [open, setOpen] = useState<boolean>(false);
        const [search, setSearch] = useState<string>("");
        const [dropUp, setDropUp] = useState<boolean>(false);
        const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
        const dropdownRef = useRef<HTMLDivElement | null>(null);
        const dropdownListRef = useRef<HTMLDivElement | null>(null);
        const userTypedRef = useRef<boolean>(false);

        const isSmall = size === "small";

        const toggleOpen = () => setOpen((prev) => !prev);

        const stringToObjects = (val: string): Option[] => {
            const values = val
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean);
            return options.filter((opt) => values.includes(String(opt.value)));
        };

        const currentSelection = useMemo<Option | Option[] | null>(() => {
            if (mode === "single") {
                return options.find((opt) => opt.value === value) || null;
            }
            return stringToObjects(value);
        }, [mode, options, value]);

        const handleSelect = (option: Option) => {
            if (mode === "single") {
                const selected = options.find((opt) => opt.value === option.value);
                if (selected) {
                    onChange?.(selected.value, selected);
                } else {
                    onChange?.("", null);
                }
                setOpen(false);
            } else {
                const selectedValues = value.split(",").filter((v) => v);
                const exists = selectedValues.includes(option.value);
                const newValues = exists
                    ? selectedValues.filter((v) => v !== option.value)
                    : [...selectedValues, option.value];
                const newValueString = newValues.join(",");
                const selectedOptions = options.filter((opt) => newValues.includes(opt.value));
                if ((onChange as Function | undefined)?.length === 2) {
                    onChange?.(newValueString, selectedOptions);
                } else {
                    onChange?.(newValueString, selectedOptions, option);
                }
                if (exists) setSearch("");
            }
        };

        const isSelected = (option: Option): boolean => {
            if (mode === "single") return value === option.value;
            return value.split(",").includes(option.value);
        };

        const filteredOptions = useMemo<Option[]>(() => {
            if (!searchable) return options;
            const q = search.toLowerCase().trim();
            if (!q) return options;
            
            return options.filter((opt) => {
                // Check if it's a string label
                if (typeof opt.label === 'string') {
                    return opt.label.toLowerCase().includes(q);
                }
                // For React.ReactNode, check the text property if available
                if ((opt as any).text) {
                    return String((opt as any).text).toLowerCase().includes(q);
                }
                // Fallback to checking value
                return String(opt.value).toLowerCase().includes(q);
            });
        }, [options, search, searchable]);

        useEffect(() => {
            const handler = (e: MouseEvent) => {
                if (!dropdownRef.current?.contains(e.target as Node)) {
                    setOpen(false);
                }
            };
            document.addEventListener("mousedown", handler);
            return () => document.removeEventListener("mousedown", handler);
        }, []);

        useEffect(() => {
            if (searchable && userTypedRef.current) {
                onSearch?.(search);
                userTypedRef.current = false;
            }
        }, [search, searchable, onSearch]);

        useEffect(() => {
            if (!open) setSearch("");
        }, [open]);

        useEffect(() => {
            if (open && dropdownRef.current) {
                const rect = dropdownRef.current.getBoundingClientRect();
                const spaceBelow = window.innerHeight - rect.bottom;
                const spaceAbove = rect.top;
                const estimatedHeight = 250;
                const shouldDropUp = spaceBelow < estimatedHeight && spaceAbove > estimatedHeight;
                
                setDropUp(shouldDropUp);
                
                // Calculate position for fixed dropdown
                setDropdownPosition({
                    top: shouldDropUp ? rect.top - estimatedHeight : rect.bottom,
                    left: rect.left,
                    width: rect.width
                });
            }
        }, [open]);

        useImperativeHandle(ref, () => ({
            getSelected: () => value,
        }));

        const sizeStyles = {
            container: isSmall ? "px-3 py-1 text-sm h-8" : "px-4 py-1.5 text-base",
            searchInput: isSmall ? "px-2 py-1.5 text-xs" : "px-3 py-1.5 text-sm",
            chip: isSmall ? "text-[0.70rem] px-2 py-[0.1rem]" : "text-[0.80rem] px-3 py-[0.15rem]",
            dropdownItem: isSmall ? "text-sm font-medium px-3 py-2" : " px-4 py-2",
        } as const;

        const singleSelection = mode === "single" ? (currentSelection as Option | null) : null;
        const multiSelection = mode === "multiple" ? ((Array.isArray(currentSelection) ? currentSelection : []) as Option[]) : [];

        return (
            <div ref={dropdownRef} className="relative w-full">
                <div
                    className={`border ${open ? "border-primary" : "border-[#E3E3E3]"}  rounded-lg shadow-xs cursor-pointer flex flex-wrap gap-2 items-center transition ${
                        Disabled ? "bg-[#1F1F1] pointer-events-none" : ""
                    } ${sizeStyles.container}`}
                    onClick={Disabled ? undefined : toggleOpen}
                    role="button"
                    aria-haspopup="listbox"
                    aria-expanded={open}
                >
                    {ShowIcon && Icon}

                    {mode === "multiple" ? (
                        <div className="flex flex-wrap gap-2 flex-1 items-center">
                            {multiSelection.length ? (
                                <>
                                    {multiSelection.slice(0, 2).map((selected, index) => (
                                        <div
                                            key={selected.value}
                                            className={`flex items-center gap-1 rounded-full bg-[#E6F2FF] text-[#005ABA] border border-[#0071E9] ${sizeStyles.chip}`}
                                            onClick={(e: React.MouseEvent<HTMLDivElement>) => {
                                                e.stopPropagation();
                                                handleSelect(selected);
                                            }}
                                            style={{ maxWidth: '300px' }}
                                        >
                                            <span className="truncate overflow-hidden text-ellipsis whitespace-nowrap flex-1" title={(selected as any)?.text || (typeof selected.label === 'string' ? selected.label : '')}>
                                                {(selected as any)?.text || selected.label}
                                            </span>
                                            <X className={`${isSmall ? "w-3 h-3" : "w-4 h-4"} shrink-0 text-[#005ABA]`} />
                                        </div>
                                    ))}
                                    {multiSelection.length > 2 && (
                                        <div
                                            key="more-badge"
                                            className={`flex items-center rounded-full bg-[#E6F2FF] text-[#005ABA] border border-[#0071E9] ${sizeStyles.chip} cursor-pointer`}
                                            onClick={(e: React.MouseEvent<HTMLDivElement>) => {
                                                e.stopPropagation();
                                            }}
                                        >
                                            +{multiSelection.length - 2} more
                                        </div>
                                    )}
                                </>
                            ) : (
                                <span className="text-gray-500 text-sm">
                                    {placeholder}
                                </span>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-between gap-2 flex-1 min-w-0">
                            <div className={`flex-1 min-w-0 ${Disabled ? "text-[#6f6f6f]" : ""}`} title={typeof singleSelection?.label === 'string' ? singleSelection.label : (singleSelection as any)?.text || ""}>
                <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                  {(singleSelection as any)?.text || (typeof singleSelection?.label === 'string' ? singleSelection.label : (singleSelection?.label || <span className="text-gray-500 text-sm">{placeholder}</span>))}
                </span>
                            </div>

                            {singleSelection && !Disabled && (
                                <X
                                    className={`text-[##1A1A1A] shrink-0 cursor-pointer hover:text-gray-600 ${isSmall ? "w-3 h-3" : "w-4 h-4"}`}
                                    onClick={(e: React.MouseEvent<SVGSVGElement>) => {
                                        e.stopPropagation();
                                        onChange?.("", null);
                                    }}
                                />
                            )}
                        </div>
                    )}

                    {open ? (
                        <ChevronUp className={`text-[#1A1A1A]  ${isSmall ? "w-5 h-5" : "w-4 h-4"}`} />
                    ) : (
                        <ChevronDown className={`text-[#1A1A1A]  ${isSmall ? "w-5 h-5" : "w-4 h-4"}`} />
                    )}
                </div>

                {open && (
                    <div
                        ref={dropdownListRef}
                        className={`fixed z-[99999] min-w-[180px] bg-background border border-background rounded-xl shadow-lg overflow-hidden ${
                            dropUp ? "mb-2" : "mt-2"
                        }`}
                        style={{
                            top: `${dropdownPosition.top}px`,
                            left: `${dropdownPosition.left}px`,
                            width: `${dropdownPosition.width}px`,
                        }}
                        role="listbox"
                    >
                            {searchable && (
                                <div className="p-2 ">
                                    <div className="relative">
                                        <input
                                            className={`w-full border border-gray-300 bg-background rounded-full focus:outline-none pr-8 ${sizeStyles.searchInput}`}
                                            placeholder="Search..."
                                            value={search}
                                            autoFocus
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                userTypedRef.current = true;
                                                setSearch(e.target.value);
                                            }}
                                        />
                                        {search && (
                                            <X
                                                className={`absolute right-2 top-2.5 text-[#1A1A1A] cursor-pointer ${isSmall ? "w-3 h-3" : "w-4 h-4"}`}
                                                onClick={() => setSearch("")}
                                            />
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="max-h-60 overflow-auto p-2">
                                {filteredOptions.length > 0 ? (
                                    filteredOptions.map((opt) => (
                                        <div
                                            key={opt.value}
                                            className={`flex justify-between rounded-lg items-center cursor-pointer transition mb-1 ${
                                                isSelected(opt) ? "bg-accent text-primary" : "hover:bg-primary/10 text-foreground/70"
                                            } ${isSelected(opt) ? (isSmall ? "px-2 py-1 text-sm" : "px-2 py-1.5 text-sm") : sizeStyles.dropdownItem}`}
                                            onClick={() => handleSelect(opt)}
                                            role="option"
                                            aria-selected={isSelected(opt)}
                                        >
                                            <span className="pr-2" title={typeof opt.label === 'string' ? opt.label : ''}>
                                                {opt.label}
                                            </span>
                                            {mode === "multiple" && isSelected(opt) && (
                                                <X className={`${isSmall ? "w-3 h-3" : "w-4 h-4"} ${isSelected(opt) ? "text-gray-900" : "text-[#1A1A1A]"}`} />
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="px-4 py-2 text-sm text-[#1A1A1A]">No options</div>
                                )}
                            </div>
                        </div>
                    )}
            </div>
        );
    }
);

export default DropdownV2;
