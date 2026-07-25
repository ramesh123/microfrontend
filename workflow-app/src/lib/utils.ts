import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { snakeCase } from "lodash";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** True when a pointer/focus event originated from a Sonner toast (not "outside" the app). */
export function isSonnerToastInteraction(target: EventTarget | null | undefined): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("[data-sonner-toaster], [data-sonner-toast]"));
}

/** Prevent Radix dismiss (sheet/dialog) when the user interacts with a Sonner toast. */
export function preventDismissIfSonnerToast(event: {
  preventDefault: () => void;
  target?: EventTarget | null;
  detail?: { originalEvent?: { target?: EventTarget | null } };
}): void {
  const target = event.detail?.originalEvent?.target ?? event.target;
  if (isSonnerToastInteraction(target)) event.preventDefault();
}


export function convertToSnakeCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(v => convertToSnakeCase(v));
  } else if (obj !== null && obj?.constructor === Object) {
    console.log(obj)
    return Object.keys(obj).reduce((acc, key) => {
      // Fix consecutive caps (e.g. ID -> Id) before snakeCase
      const normalizedKey = key.replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2"); 
      const newKey = snakeCase(normalizedKey);
      console.log("Key:", key, "Normalized Key:", normalizedKey, "New Key:", newKey);
      acc[newKey] = convertToSnakeCase(obj[key]);
      return acc;
    }, {} as Record<string, any>);
  }
  return obj;
}
