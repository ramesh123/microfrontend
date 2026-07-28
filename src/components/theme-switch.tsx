import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useTheme } from '@/context/theme'
import { cn } from '@/lib/utils'
import { CheckIcon, MoonIcon, SunIcon, LeafIcon } from 'lucide-react' // Added LeafIcon for fun
import { useEffect } from 'react'

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme()

  /* Update theme-color meta tag when theme is updated */
  useEffect(() => {
    // You might want to define a specific color for the new theme as well
    const themeColor = theme === 'dark' || theme === 'blue-dark-g' ? '#020817' : '#fff' 
    const metaThemeColor = document.querySelector("meta[name='theme-color']")
    if (metaThemeColor) metaThemeColor.setAttribute('content', themeColor)
  }, [theme])

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' size='icon' className='scale-95 rounded-full'>
          <SunIcon className='size-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0' />
          <MoonIcon className='absolute size-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100' />
          <span className='sr-only'>Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        {/* <DropdownMenuItem onClick={() => setTheme('light')}>
          Light
          <CheckIcon
            size={14}
            className={cn('ml-auto', theme !== 'light' && 'hidden')}
          />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('orange-light')}>
          Orange Light
          <CheckIcon
            size={14}
            className={cn('ml-auto', theme !== 'orange-light' && 'hidden')}
          />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('orange-dark')}>
          Orange Dark
          <CheckIcon
            size={14}
            className={cn('ml-auto', theme !== 'orange-dark' && 'hidden')}
          />
        </DropdownMenuItem> */}
        <DropdownMenuItem onClick={() => setTheme('blue-light')}>
          Blue Light
          <CheckIcon
            size={14}
            className={cn('ml-auto', theme !== 'blue-light' && 'hidden')}
          />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('blue-dark')}>
          Blue Dark
          <CheckIcon
            size={14}
            className={cn('ml-auto', theme !== 'blue-dark' && 'hidden')}
          />
        </DropdownMenuItem>
        {/* <DropdownMenuItem onClick={() => setTheme('purple-light')}>
          Purple Light
          <CheckIcon
            size={14}
            className={cn('ml-auto', theme !== 'purple-light' && 'hidden')}
          />
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => setTheme('purple-dark')}>
          Purple Dark
          <CheckIcon
            size={14}
            className={cn('ml-auto', theme !== 'purple-dark' && 'hidden')}
          />
        </DropdownMenuItem> */}



        <DropdownMenuItem onClick={() => setTheme('system')}>
          System
          <CheckIcon
            size={14}
            className={cn('ml-auto', theme !== 'system' && 'hidden')}
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}










// import React, { useState } from 'react';
// import { Button } from '@/components/ui/button';
// import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
// import { Check, ChevronDown, Palette } from 'lucide-react';
// import { cn } from '@/lib/utils';

// /**
//  * Defines the shape of a theme option for the CustomThemeSelector.
//  * @param id - A unique identifier for the theme.
//  * @param label - The display name for the theme.
//  * @param colors - An array of color strings (e.g., hex, hsl) for the preview.
//  */
// export interface CustomThemeOption {
//   id: string;
//   label: string;
//   colors: string[];
// }

// interface CustomThemeSelectorProps {
//   /** An array of theme objects to display in the dropdown. */
//   themes: CustomThemeOption[];
//   /** The ID of the currently selected theme. */
//   selectedThemeId: string;
//   /** Callback function triggered when a new theme is selected. */
//   onThemeChange: (id: string) => void;
//   /** Optional className to apply to the root container. */
//   className?: string;
// }

// /**
//  * A sub-component that renders a single theme row in the dropdown list.
//  */
// const CustomThemeRow: React.FC<{
//   theme: CustomThemeOption;
//   isSelected: boolean;
//   onSelect: () => void;
// }> = ({ theme, isSelected, onSelect }) => {
//   return (
//     <div
//       className={cn(
//         "flex items-center gap-3 p-3 hover:bg-accent rounded-lg cursor-pointer transition-colors",
//         isSelected && "bg-accent"
//       )}
//       onClick={onSelect}
//       role="option"
//       aria-selected={isSelected}
//     >
//       <div className="flex gap-1.5" aria-hidden="true">
//         {theme.colors.slice(0, 4).map((color, index) => (
//           <div
//             key={index}
//             className="w-4 h-4 rounded-full border border-border"
//             style={{ backgroundColor: color }}
//           />
//         ))}
//       </div>
//       <span className="text-sm font-medium flex-1">{theme.label}</span>
//       {isSelected && <Check className="w-4 h-4 text-primary" />}
//     </div>
//   );
// };

// /**
//  * A reusable and customizable theme selector dropdown component.
//  * It takes a label and an array of colors for each theme option.
//  */
// export const ThemeSwitch: React.FC<CustomThemeSelectorProps> = ({
//   themes,
//   selectedThemeId,
//   onThemeChange,
//   className,
// }) => {
//   const [isOpen, setIsOpen] = useState(false);

//   const selectedTheme = themes.find((t) => t.id === selectedThemeId) || themes[0];

//   const handleSelect = (id: string) => {
//     onThemeChange(id);
//     setIsOpen(false);
//   };

//   if (!selectedTheme) {
//     return null;
//   }

//   return (
//     <div className={cn('flex items-center', className)}>
//       <Popover open={isOpen} onOpenChange={setIsOpen}>
//         <PopoverTrigger asChild>
//           <Button variant="outline" className="gap-2 min-w-[150px] justify-between">
//             <div className="flex items-center gap-2">
//               <Palette className="w-4 h-4" />
//               <span>{selectedTheme.label}</span>
//             </div>
//             <ChevronDown className="w-3 h-3 text-muted-foreground" />
//           </Button>
//         </PopoverTrigger>
//         <PopoverContent className="w-64 p-2" align="end">
//           <div className="space-y-1 max-h-80 overflow-y-auto">
//             {themes.map((theme) => (
//               <CustomThemeRow
//                 key={theme.id}
//                 theme={theme}
//                 isSelected={theme.id === selectedThemeId}
//                 onSelect={() => handleSelect(theme.id)}
//               />
//             ))}
//           </div>
//         </PopoverContent>
//       </Popover>
//     </div>
//   );
// };
