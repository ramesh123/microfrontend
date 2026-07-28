import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import brandFaviconUrl from '../public/assets/KPMG.png'
import './index.css'
{
  const link = document.createElement('link')
  link.rel = 'icon'
  link.type = 'image/jpeg'
  link.href = brandFaviconUrl
  document.head.appendChild(link)
}

// Prevent "rubber-band" overscroll on trackpads that can reveal blank space above the app.
{
  const html = document.documentElement
  const body = document.body
  const root = document.getElementById('root')

  html.style.height = '100%'
  html.style.overscrollBehaviorY = 'none'
  html.style.overflow = 'hidden'

  body.style.height = '100%'
  body.style.margin = '0'
  body.style.overscrollBehaviorY = 'none'
  body.style.overflow = 'hidden'

  if (root) {
    root.style.height = '100%'
    root.style.overflow = 'hidden'
  }
}
import "@xyflow/react/dist/style.css";
import './styles/applies.css';
import "./styles/ag-theme-shadcn.css";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router'
import { RoutesApp } from './router'
import { ThemeProvider } from '@/context/theme'
import { AuthProvider } from '@/context/auth/authContext'
import { ReactFlowProvider } from '@xyflow/react'
import ChunkLoadErrorBoundary from '@/components/common/ChunkLoadErrorBoundary'

import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Toaster } from 'sonner';


const queryClient = new QueryClient()
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChunkLoadErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <DndProvider backend={HTML5Backend}>
              <ReactFlowProvider>
                <ThemeProvider>
                  <Toaster
                    position="top-right"
                    className="z-[200]"
                    richColors
                    closeButton
                    duration={5000}
                    swipeDirections={["right", "left"]}
                    visibleToasts={6}
                    expand
                  />
                  <RoutesApp />
                </ThemeProvider>
              </ReactFlowProvider>
            </DndProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ChunkLoadErrorBoundary>
  </StrictMode>,
)
