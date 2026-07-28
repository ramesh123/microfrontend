import { useState, lazy } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import CreateWorkflowDialog from './components/CreateWorkflowDialog';
const LibraryPage = lazy(() => import('./components/LibraryPage'))

export default function MainPage() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [activeLibraryTab, setActiveLibraryTab] = useState('templates');
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);

  const handleOpenDialog = () => setCreateDialogOpen(true);

  const handleNavigateToWorkflows = () => {
    setCurrentPage('library');
    setActiveLibraryTab('workflows');
  };

  const handleNavigateToTemplates = () => {
    setCurrentPage('library');
    setActiveLibraryTab('templates');
  };

  const renderPageContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          // <Dashboard 
          //   onNavigateToWorkflows={handleNavigateToWorkflows} 
          //   onNavigateToTemplates={handleNavigateToTemplates}
          //   onOpenCreateDialog={handleOpenDialog}
          // />
          <></>
        );

      case 'library':
        return (
          <LibraryPage
            onOpenCreateDialog={handleOpenDialog}
            activeTab={activeLibraryTab}
            onTabChange={setActiveLibraryTab}
          />
        );

      case 'analytics':
        return (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-4">Analytics</h2>
            <p className="text-gray-600">Advanced analytics features coming soon...</p>
          </div>
        );

      case 'sources':
        return (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-4">Data Sources</h2>
            <p className="text-gray-600">Data source management coming soon...</p>
          </div>
        );

      case 'settings':
        return (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-4">Settings</h2>
            <p className="text-gray-600">Application settings coming soon...</p>
          </div>
        );

      default:
      // return <Dashboard 
      //           onNavigateToWorkflows={handleNavigateToWorkflows} 
      //           onNavigateToTemplates={handleNavigateToTemplates}
      //           onOpenCreateDialog={handleOpenDialog}
      //         />;
    }
  };

  const getPageTitle = () => {
    switch (currentPage) {
      case 'dashboard':
        return 'Dashboard';
      case 'library':
        return 'Library';
      case 'analytics':
        return 'Analytics';
      case 'sources':
        return 'Data Sources';
      case 'settings':
        return 'Settings';
      default:
        return 'Dashboard';
    }
  };

  return (
    // <SidebarProvider>
    //   <AppSidebar currentPage={currentPage} onPageChange={setCurrentPage} />
    //   <SidebarInset>
    <div className='overflow-auto'>
      {/* <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 overflow-auto"> */}
      {/* <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white/80 backdrop-blur-sm px-4 sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{getPageTitle()}</h2>
              </div>
            </div>
          </header> */}

      {/* <div className="mx-auto px-4 py-4">
            {renderPageContent()}
          </div> */}
      {/* </div> */}
      {/* </SidebarInset> */}
      <CreateWorkflowDialog
        open={isCreateDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
    // </SidebarProvider>
  );
}
