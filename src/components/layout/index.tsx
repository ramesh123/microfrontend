import { AppSidebar } from '@/components/app-sidebar'
import { Header } from '@/components/header'
import { SidebarProvider } from '@/components/ui/sidebar'
import { CollapsedSelectionProvider } from '@/components/CollapsedSelectionContext'
import { CommandMenu } from '@/components/command-menu'
import { SearchProvider } from '@/context/search'
import { cn } from '@/lib/utils'
import Cookies from 'js-cookie'
import { Outlet } from 'react-router'
import { SidebarDataComponent } from './data/sidebar-data'
import { useSidebarStore } from '@/stores/sidebarStore'
import { ThemeSwitch } from '../theme-switch'
import { useRbacStore } from '@/stores/useRBACStore'

export default function Layout() {
  const { sidebarData } = SidebarDataComponent()
  const isCollapsed = useSidebarStore((state) => state.isCollapsed)
  const { activePerspective } = useRbacStore()

  const defaultOpen = Cookies.get('sidebar:state') !== 'false'

  return (
    <SearchProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <CollapsedSelectionProvider>
          <AppSidebar />
        <div
          id='content'
          className={cn(
            'ml-auto w-full max-w-full',
            'overflow-x-hidden',
            'transition-[width] duration-200 ease-linear',
            'flex flex-col h-screen'
          )}
        >
          <Header className='mb-2'>
            <span className='mr-2 truncate font-semibold'>
              {sidebarData.app.name}
            </span>
            <div className='ml-auto flex items-center space-x-4'>
            {/* {activePerspective && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border">
                  <ForwardedIconComponent name={activePerspective?.icon || 'File'} className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{activePerspective?.name}</span>
                </div>
              )} */}
              {/* <Search /> */}
              {/* <AdvancedThemeSelector /> */}
              {/* <ThemeSwitch themes={sampleCustomThemes} selectedThemeId={selectedThemeId} onThemeChange={setSelectedId} /> */}
              {/* <ThemeSwitch /> */}
            </div>
          </Header>
          <main className="px-0 py-0 p-0 overflow-y-auto overflow-x-hidden overscroll-none flex-1 w-full max-w-full flex flex-col min-h-0">
            <Outlet />
          </main>
        </div>
        </CollapsedSelectionProvider>
      </SidebarProvider>
      <CommandMenu />
    </SearchProvider>
  )
}

