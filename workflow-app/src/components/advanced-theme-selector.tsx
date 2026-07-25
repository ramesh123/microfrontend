// import React, { useState, useMemo } from 'react';
// import { useTheme } from '@/context/theme';
// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
// import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
// import { Search, Heart, Sun, Moon, Shuffle, Check, ChevronDown, Palette } from 'lucide-react';
// import { cn } from '@/lib/utils';
// import { Theme } from '@/context/theme';
// import { defaultPresets } from '@/utils/theme-presets';

// interface ColorDotProps {
//     color: string;
//     className?: string;
//   }
  
//   const ColorDot: React.FC<ColorDotProps> = ({ color, className }) => (
//     <div 
//       className={cn("w-4 h-4 rounded-full border border-gray-200 dark:border-gray-700", className)}
//       style={{ backgroundColor: color }}
//     />
//   );
  
//   interface ThemeRowProps {
//     theme: Theme;
//     isSelected: boolean;
//     onSelect: (theme: Theme) => void;
//   }
  
//   const ThemeRow: React.FC<ThemeRowProps> = ({ theme, isSelected, onSelect }) => {
//     const preset = defaultPresets[theme.id];
//     // Use light mode for a consistent preview
//     const styles = preset?.styles.light;
//     const themeColors = styles ? {
//         primary: `hsl(${styles['--primary']})`,
//         secondary: `hsl(${styles['--secondary']})`,
//         accent: `hsl(${styles['--accent']})`,
//         muted: `hsl(${styles['--muted']})`,
//     } : null;
  
//     return (
//       <div 
//         className={cn(
//           "flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors",
//           isSelected && "bg-gray-50 dark:bg-gray-800"
//         )}
//         onClick={() => onSelect(theme)}
//       >
//         {themeColors && (
//           <div className="flex gap-1">
//             <ColorDot color={themeColors.primary} />
//             <ColorDot color={themeColors.secondary} />
//             <ColorDot color={themeColors.accent} />
//             <ColorDot color={themeColors.muted} />
//           </div>
//         )}
//         <span className="text-sm font-medium flex-1">{theme.name}</span>
//         {isSelected && (
//           <Check className="w-4 h-4 text-primary" />
//         )}
//       </div>
//     );
//   };
  
//   interface AdvancedThemeSelectorProps {
//     className?: string;
//   }
  
//   export const AdvancedThemeSelector: React.FC<AdvancedThemeSelectorProps> = ({ className }) => {
//     const { theme, setTheme } = useTheme();
//     const [searchTerm, setSearchTerm] = useState('');
//     const [isOpen, setIsOpen] = useState(false);
  
//     const filteredThemes = useMemo(() => {
//       if (!searchTerm) return availableThemes;
//       return availableThemes.filter(theme => 
//         theme.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
//         theme.description?.toLowerCase().includes(searchTerm.toLowerCase())
//       );
//     }, [availableThemes, searchTerm]);
  
//     const handleThemeSelect = (theme: Theme) => {
//       switchTheme(theme.id);
//       setIsOpen(false);
//     };
  
//     const handleModeToggle = () => {
//       const modes = ['light', 'dark', 'system'];
//       const currentIndex = modes.indexOf(currentMode);
//       const nextMode = modes[(currentIndex + 1) % modes.length];
//       switchMode(nextMode as any);
//     };
  
//     const randomTheme = () => {
//       const randomIndex = Math.floor(Math.random() * availableThemes.length);
//       const theme = availableThemes[randomIndex];
//       if (theme && theme.id !== currentTheme.id) {
//         handleThemeSelect(theme);
//       }
//     };
  
//     const ModeIcon = currentMode === 'light' ? Sun : currentMode === 'dark' ? Moon : Sun;
  
//     return (
//       <div className={cn("flex items-center gap-2", className)}>
//         <Popover open={isOpen} onOpenChange={setIsOpen}>
//           <PopoverTrigger asChild>
//             <Button variant="outline" className="gap-2 min-w-[120px]">
//               <Palette className="w-4 h-4" />
//               <span className="hidden sm:inline">{currentTheme.name}</span>
//               <ChevronDown className="w-3 h-3" />
//             </Button>
//           </PopoverTrigger>
//           <PopoverContent className="w-80 p-0" align="end">
//             <div className="flex flex-col">
//               {/* Search Header */}
//               <div className="p-4 border-b">
//                 <div className="relative">
//                   <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
//                   <Input
//                     placeholder="Search themes..."
//                     value={searchTerm}
//                     onChange={(e) => setSearchTerm(e.target.value)}
//                     className="pl-10"
//                   />
//                 </div>
//               </div>
  
//               {/* Stats and Controls */}
//               <div className="flex items-center justify-between p-4 border-b">
//                 <span className="text-sm text-muted-foreground">
//                   {filteredThemes.length} themes
//                 </span>
//                 <div className="flex items-center gap-2">
//                   <Button 
//                     variant="ghost" 
//                     size="sm" 
//                     onClick={handleModeToggle}
//                     className="h-8 w-8 p-0"
//                   >
//                     <ModeIcon className="w-4 h-4" />
//                   </Button>
//                   <Button 
//                     variant="ghost" 
//                     size="sm" 
//                     onClick={randomTheme}
//                     className="h-8 w-8 p-0"
//                   >
//                     <Shuffle className="w-4 h-4" />
//                   </Button>
//                 </div>
//               </div>
  
//               {/* Saved Themes Section */}
//               <div className="p-4 border-b">
//                 <div className="flex items-center gap-2 text-muted-foreground">
//                   <Heart className="w-4 h-4" />
//                   <span className="text-sm">Save</span>
//                   <span className="text-sm">a theme to find it here.</span>
//                 </div>
//               </div>
  
//               {/* Built-in Themes */}
//               <div className="p-4">
//                 <h3 className="text-sm font-medium text-muted-foreground mb-3">Built-in Themes</h3>
//                 <div className="space-y-1 max-h-80 overflow-y-auto">
//                   {filteredThemes.map((theme) => (
//                     <ThemeRow
//                       key={theme.id}
//                       theme={theme}
//                       isSelected={theme.id === currentTheme.id}
//                       onSelect={handleThemeSelect}
//                     />
//                   ))}
//                 </div>
//               </div>
  
//               {filteredThemes.length === 0 && (
//                 <div className="p-8 text-center text-muted-foreground">
//                   <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
//                   <p className="text-sm">No themes found matching '{searchTerm}'</p>
//                 </div>
//               )}
//             </div>
//           </PopoverContent>
//         </Popover>
//       </div>
//     );
//   };
  