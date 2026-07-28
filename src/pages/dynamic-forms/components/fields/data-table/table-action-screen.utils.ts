import type { FormBuilderTableScreenSize } from '../../../types';

export const TABLE_SCREEN_SIZE_OPTIONS: {
  value: FormBuilderTableScreenSize;
  label: string;
  hint: string;
}[] = [
  { value: 'sm', label: 'Small', hint: '360 × 360' },
  { value: 'md', label: 'Medium', hint: '520 × 480' },
  { value: 'lg', label: 'Large', hint: '720 × 640' },
  { value: 'xl', label: 'Extra large', hint: '960 × 80vh' },
  { value: 'full', label: 'Full', hint: 'Almost fullscreen' },
];

/** Shared width/height classes for dialog and sheet screens. */
export function getTableScreenSizeClasses(size: FormBuilderTableScreenSize = 'md'): {
  dialog: string;
  sheet: string;
} {
  switch (size) {
    case 'sm':
      return {
        dialog: 'w-[min(96vw,360px)] h-[min(80vh,360px)]',
        sheet: 'w-[min(96vw,360px)] sm:max-w-[360px]',
      };
    case 'lg':
      return {
        dialog: 'w-[min(96vw,720px)] h-[min(85vh,640px)]',
        sheet: 'w-[min(96vw,720px)] sm:max-w-[720px]',
      };
    case 'xl':
      return {
        dialog: 'w-[min(96vw,56rem)] min-w-[min(96vw,40rem)] h-[min(90vh,720px)]',
        sheet: 'w-[min(96vw,56rem)] sm:max-w-[56rem]',
      };
    case 'full':
      return {
        dialog: 'w-[min(98vw,72rem)] min-w-[min(96vw,48rem)] h-[90vh]',
        sheet: 'w-[min(98vw,72rem)] sm:max-w-[72rem]',
      };
    case 'md':
    default:
      return {
        dialog: 'w-[min(96vw,520px)] h-[min(80vh,480px)]',
        sheet: 'w-[min(96vw,520px)] sm:max-w-[520px]',
      };
  }
}
