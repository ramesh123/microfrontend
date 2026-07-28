import '@xyflow/react/dist/style.css';
import './styles/applies.css';
import './styles/ag-theme-shadcn.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router';
import { RoutesApp } from './router';
import { ThemeProvider } from '@/context/theme';
import { AuthProvider } from '@/context/auth/authContext';
import { ReactFlowProvider } from '@xyflow/react';
import ChunkLoadErrorBoundary from '@/components/common/ChunkLoadErrorBoundary';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Toaster } from 'sonner';

const queryClient = new QueryClient();

export default function App() {
  return (
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
                    swipeDirections={['right', 'left']}
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
  );
}
