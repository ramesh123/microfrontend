import { AppSidebar } from '@/components/app-sidebar'
import { Header } from '@/components/header'
import { SidebarProvider } from '@/components/ui/sidebar'
import { CommandMenu } from '@/components/command-menu'
import { SearchProvider } from '@/context/search'
import { cn } from '@/lib/utils'
import Cookies from 'js-cookie'
import { Outlet, useLocation } from 'react-router'
import { Search } from '@/components/search'
// import { ThemeSwitch } from '@/components/theme-switch'
import { SidebarDataComponent } from './data/sidebar-data'
import { useSidebarStore } from '@/stores/sidebarStore'
import { ThemeSwitch } from '../theme-switch'
import { useState } from 'react'
import ForwardedIconComponent from '../common/genericIconComponent'
import { useRbacStore } from '@/stores/useRBACStore'
import { DynamicFormRouteOverride } from '@/pages/dynamic-forms/components/runtime/DynamicFormRouteOverride'
import { MessageCircle } from 'lucide-react'
import { AiChatDialog } from '@/pages/FlowPage/Aichatbox'
// import { AdvancedThemeSelector } from '../advanced-theme-selector'

export default function Layout() {
  const { sidebarData } = SidebarDataComponent()
  const isCollapsed = useSidebarStore((state) => state.isCollapsed)
  const { activePerspective } = useRbacStore()
  const location = useLocation()
  const isWorkflowPage =
    location.pathname.startsWith('/workflows/') &&
    !location.pathname.startsWith('/workflows/create');
  const isDraftWorkflowPage = location.pathname.startsWith('/draft_workflows/');
  const isApiGatewayPage = location.pathname.startsWith('/api-gateway');
  const isLandingPage = location.pathname === '/landing';

  const defaultOpen = Cookies.get('sidebar:state') !== 'false'

  const sampleCustomThemes: any[] = [
    { id: 'cyberpunk-night', label: 'Cyberpunk Night', colors: ['#f400f4', '#00f0f0', '#2a004a', '#0a0a0a'] },
    { id: 'earthy-tones', label: 'Earthy Tones', colors: ['#e2725b', '#808000', '#f5f5dc', '#5d4037'] },
    { id: 'pastel-dreams', label: 'Pastel Dreams', colors: ['#e6e6fa', '#bdfcc9', '#ffb6c1', '#fffacd'] },
    { id: 'monochrome', label: 'Monochrome', colors: ['#212121', '#757575', '#e0e0e0', '#ffffff'] },
  ];

  const selectedThemeId = 'cyberpunk-night';
  const [selectedId, setSelectedId] = useState<string>('cyberpunk-night');
  const [aiOpen, setAiOpen] = useState(false)


  return (
    <SearchProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
         {!isWorkflowPage && !isDraftWorkflowPage && !isApiGatewayPage && <AppSidebar />}
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
            <DynamicFormRouteOverride>
              <Outlet />
            </DynamicFormRouteOverride>

            {/* Floating AI button (bottom-right) – hidden on AI landing page */}
            {(isWorkflowPage || isDraftWorkflowPage) && (
              <div className="fixed bottom-6 right-6 z-50 group">
                <button
                  onClick={() => setAiOpen(true)}
                  className="
                    flex items-center gap-0
                    h-14
                    w-14 group-hover:w-58
                    overflow-hidden
                    rounded-full
                    text-primary-foreground
                    shadow-lg
                    transition-all duration-300 ease-out
                    ai-float-animate
                  "
                  style={{ background: 'conic-gradient(from 0deg, #6366f1, #a21caf, #6366f1 100%)' }}
                >
                  {/* Icon */}
                  <div className="flex h-14 w-14 items-center justify-center shrink-0">
                    <MessageCircle className="h-6 w-6" />
                  </div>

                  {/* Text */}
                  <span
                    className="
                      whitespace-nowrap text-sm font-medium
                      opacity-0 translate-x-2
                      group-hover:opacity-100 group-hover:translate-x-0
                      transition-all duration-300 delay-100
                    "
                  >
                    Ask me about the flow
                  </span>
                </button>
              </div>
            )}

            <AiChatDialog open={aiOpen} onOpenChange={setAiOpen} mode={'PIPELINE'} />

            {/* Floating animation style */}
            <style>{`
              @keyframes ai-float {
                0% { transform: translateY(0); }
                50% { transform: translateY(-12px); }
                100% { transform: translateY(0); }
              }
              .ai-float-animate {
                animation: ai-float 2.2s ease-in-out infinite;
              }
            `}</style>
          </main>
        </div>
      </SidebarProvider>
      <CommandMenu />
    </SearchProvider>
  )
}

