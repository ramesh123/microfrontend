import React from 'react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@/components/ui/command'
import { useSearch } from '@/context/search'
import { useTheme } from '@/context/theme'
import { ChevronRightIcon, LaptopIcon, SunIcon } from 'lucide-react'
import { useNavigate } from 'react-router'
import { SidebarDataComponent } from './layout/data/sidebar-data'
import { ScrollArea } from '@/components/ui/scroll-area'

export function CommandMenu() {
  const navigate = useNavigate()

  const { sidebarData } = SidebarDataComponent()

  const { setTheme } = useTheme()
  const { open, setOpen } = useSearch()

  const runCommand = React.useCallback(
    (command: () => unknown) => {
      setOpen(false)
      command()
    },
    [setOpen]
  )

  return (
    <CommandDialog modal open={open} onOpenChange={setOpen}>
      <CommandInput placeholder='Type a command or search...' />
      <CommandList>
        <ScrollArea type='hover' className='h-72 pr-1'>
          <CommandEmpty>No results found.</CommandEmpty>
          {/* ... existing command groups ... */}
          {sidebarData.navGroups.map(group => (
            <CommandGroup key={group.title} heading={group.title}>
              {group.children.map((navItem, i) => {
                if (navItem.path)
                  return (
                    <CommandItem
                      key={`${navItem.path}-${i}`}
                      value={navItem.title}
                      onSelect={() => {
                        runCommand(() => navigate(navItem.path))
                      }}
                    >
                      <div className='mr-2 flex h-4 w-4 items-center justify-center'>
                        <ChevronRightIcon className='size-2 text-muted-foreground/80' />
                      </div>
                      {navItem.title}
                    </CommandItem>
                  )

                return navItem.children?.map((subItem, i) => (
                  <CommandItem
                    key={`${subItem.path}-${i}`}
                    value={subItem.title}
                    onSelect={() => {
                      runCommand(() => navigate(subItem.path))
                    }}
                  >
                    <div className='mr-2 flex h-4 w-4 items-center justify-center'>
                      <ChevronRightIcon className='size-2 text-muted-foreground/80' />
                    </div>
                    {subItem.title}
                  </CommandItem>
                ))
              })}
            </CommandGroup>
          ))}
          <CommandSeparator />
          <CommandGroup heading='Theme'>
            {/* <CommandItem onSelect={() => runCommand(() => setTheme('light'))}>
              <SunIcon className='mr-2 size-4' /> <span>Light</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme('orange-light'))}>
              <SunIcon className='mr-2 size-4' /> <span>Orange Light</span>
            </CommandItem> */}
            <CommandItem onSelect={() => runCommand(() => setTheme('system'))}>
              <LaptopIcon className='mr-2 size-4' />
              <span>System</span>
            </CommandItem>
          </CommandGroup>
        </ScrollArea>
      </CommandList>
    </CommandDialog>
  )
}
