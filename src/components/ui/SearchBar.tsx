import React from "react";

const sizeClasses = {
    small: "px-2 py-1 text-sm",
    medium: "px-3 py-1.5 text-base",
    large: "px-5 py-3 text-lg",
} as const;

type SearchBarSize = keyof typeof sizeClasses;

type SearchBarProps = {
    currentValue: string;
    onSearch: (value: string) => void;
    size?: SearchBarSize;
    children?: React.ReactNode;
};

export default function SearchBar({
                                      currentValue,
                                      onSearch,
                                      size = "medium",
                                  }: SearchBarProps) {
    const clearSearch = (): void => {
        onSearch("");
    };

    return (
        <div
            className={`flex items-center w-full max-w-md bg-background border border-border rounded-lg shadow-sm ${sizeClasses[size]}`}
        >
            <svg
                className="w-5 h-5 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                aria-hidden="true"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z"
                />
            </svg>
            <input
                type="text"
                value={currentValue}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onSearch(e.target.value)
                }

                placeholder="Search"
                className="ml-3 bg-transparent placeholder:text-muted-foreground text-foreground outline-none w-full"
            />
            {currentValue && (
                <button
                    onClick={clearSearch}
                    className="ml-2 cursor-pointer text-muted-foreground hover:text-foreground focus:outline-none"
                    aria-label="Clear search"
                >
                    <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            )}
        </div>
    );
}
