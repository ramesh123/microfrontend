import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";

import { parseIconSizePx } from "./lucideIconMarkup";

interface IconSizeInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  step?: number;
  className?: string;
}

function readPx(value: string): number {
  const raw = value.replace(/px/gi, "").trim();
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

export function IconSizeInput({
  value,
  onChange,
  disabled = false,
  step = 1,
  className,
}: IconSizeInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [draft, setDraft] = useState("");

  const displayValue = isFocused ? draft : value;

  const handleFocus = () => {
    setIsFocused(true);
    setDraft(value.replace(/px/gi, "").trim() || String(readPx(value) || parseIconSizePx(value, 24)));
  };

  const handleBlur = () => {
    setIsFocused(false);
    const raw = draft.replace(/px/gi, "").trim();
    if (raw === "") {
      onChange("");
      return;
    }
    const n = parseInt(raw, 10);
    if (Number.isFinite(n)) {
      onChange(`${n}px`);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraft(e.target.value);
  };

  const stepPx = (delta: number) => {
    let base: number;
    if (isFocused) {
      const raw = draft.replace(/px/gi, "").trim();
      const n = parseInt(raw, 10);
      base = Number.isFinite(n) ? n : readPx(value) || parseIconSizePx(value, 24);
      setIsFocused(false);
    } else {
      base = readPx(value) || parseIconSizePx(value, 24);
    }
    onChange(`${base + delta}px`);
  };

  return (
    <div
      className={cn(
        "flex h-9 items-stretch overflow-hidden rounded-md border border-input bg-background shadow-sm",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      <input
        type="text"
        value={displayValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="h-full w-[60px] shrink-0 border-0 bg-transparent px-2 text-center text-sm outline-none"
        placeholder="24px"
        disabled={disabled}
        inputMode="numeric"
        aria-label="Icon height in pixels"
      />
      <div className="flex w-5 shrink-0 flex-col border-l border-input">
        <button
          type="button"
          className="flex h-1/2 flex-1 items-center justify-center hover:bg-muted disabled:opacity-40"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => stepPx(step)}
          aria-label="Increase icon height"
        >
          <ChevronUp className="size-1.5 text-muted-foreground" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          className="flex h-1/2 flex-1 items-center justify-center border-t border-input hover:bg-muted disabled:opacity-40"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => stepPx(-step)}
          aria-label="Decrease icon height"
        >
          <ChevronDown className="size-1.5 text-muted-foreground" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
