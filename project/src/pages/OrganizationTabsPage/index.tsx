import { useState, useEffect } from 'react';
import { generateMockOrganizations, tabsData } from './data/mockData';
import { Organization } from './types/organization';

// Import all tab components
import { OrgDetailsTab } from './tabs/OrgDetailsTab';
import { MainBusinessUnitsTab } from './tabs/MainBusinessUnitsTab';
import { MainBusinessProcessTab } from './tabs/MainBusinessProcessTab';
import { ApplicationsTab } from './tabs/ApplicationsTab';
// import { TransactionsTab } from './tabs/TransactionsTab';
// import { IntegrationsTab } from './tabs/IntegrationsTab';
// import { ProgramsTab } from './tabs/ProgramsTab';
// import { FeaturesTab } from './tabs/FeaturesTab';
// import { ObjectsTab } from './tabs/ObjectsTab';
// import { AdaptersTab } from './tabs/AdaptersTab';
// import { GrabberTab } from './tabs/GrabberTab';
// import { OthersTab } from './tabs/OthersTab';

export function OrganizationTabs() {
  const [activeTab, setActiveTab] = useState('org-details');
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  useEffect(() => {
    const organisatioSetter = async () => {
      setOrganizations(await generateMockOrganizations())
    }
    organisatioSetter()
  }, [])

  const handleUpdateOrganizations = (updatedOrgs: Organization[]) => {
    setOrganizations(updatedOrgs);
  };

  const tabComponents: { [key: string]: React.ComponentType<any> } = {
    'org-details': OrgDetailsTab,
    'business-units': MainBusinessUnitsTab,
    'business-process': MainBusinessProcessTab,
    'applications': ApplicationsTab,
    // 'transactions': TransactionsTab,
    // 'integrations': IntegrationsTab,
    // 'programs': ProgramsTab,
    // 'features': FeaturesTab,
    // 'objects': ObjectsTab,
    // 'adapters': AdaptersTab,
    // 'grabber': GrabberTab,
    // 'others': OthersTab,
  };

  return (
    <div className="w-full mx-auto px-2 ml-[-0.3rem]">
      <div className="gradient-border-container shadow-sm">
        <div className="bg-card rounded-[11px] overflow-hidden">
          <div className="w-full">
            {/* Enhanced Tab Navigation */}
            <div className="px-2 sm:px-4 border-b border-border bg-muted/50">
              <div className="flex overflow-x-auto scrollbar-hide custom-scrollbar">
                <div className="flex space-x-1 min-w-max py-2">
                  {tabsData.map((tab, index) => {
                    const isActive = activeTab === tab.id;
                    if (isActive) {
                      return (
                        <div
                          key={tab.id}
                          className="p-px rounded-full bg-gradient-to-r from-accent to-primary shadow-sm"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <button
                            onClick={() => setActiveTab(tab.id)}
                            className="bg-gradient-to-r from-accent to-primary text-white px-3 py-2 text-sm font-medium rounded-full transition-all duration-300 ease-in-out whitespace-nowrap"
                          >
                            {tab.label}
                          </button>
                        </div>
                      );
                    } else {
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className="relative px-3 py-2 text-sm font-medium rounded-full transition-all duration-300 ease-in-out whitespace-nowrap group text-muted-foreground hover:text-foreground hover:bg-background/50"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          {tab.label}
                          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-0 h-0.5 bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-300 group-hover:w-full"></div>
                        </button>
                      );
                    }
                  })}
                </div>
              </div>
            </div>

            {/* Enhanced Tab Content */}
            <div className="p-4 bg-card min-h-[550px]">
              {tabsData.map((tab) => {
                const TabComponent = tabComponents[tab.id as keyof typeof tabComponents];
                return (
                  <div
                    key={tab.id}
                    className={`transition-all duration-500 ease-in-out ${activeTab === tab.id
                      ? 'block opacity-100 transform translate-y-0'
                      : 'hidden opacity-0 transform translate-y-4'
                      }`}
                  >
                    <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                      <TabComponent organizations={organizations} onUpdateOrganizations={handleUpdateOrganizations} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
