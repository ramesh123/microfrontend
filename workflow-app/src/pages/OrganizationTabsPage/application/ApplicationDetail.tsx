import { useState } from 'react';
import { ArrowLeft, Receipt, Star, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Application } from '../types/organization';
import { TransactionManager } from './TransactionManager';
import { FeatureManager } from './FeatureManager';
import { ProgramManager } from './ProgramManager';

interface ApplicationDetailProps {
  app: Application;
  orgName: string;
  onBack: () => void;
  onUpdate: (updatedApp: Application) => void;
}

export function ApplicationDetail({ app, orgName, onBack, onUpdate }: ApplicationDetailProps) { 
  const [activeTab, setActiveTab] = useState('transactions');
  return ( 
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h2 className="text-lg font-bold text-foreground">{app.name}</h2>
            <p className="text-sm text-muted-foreground">{orgName}</p>
          </div>
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-4 py-3 border-b bg-muted/50">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-2 bg-background p-1 rounded-full">
              <TabsTrigger value="transactions"><Receipt className="h-4 w-4 mr-2" />Transactions</TabsTrigger>
              <TabsTrigger value="features"><Star className="h-4 w-4 mr-2" />Features</TabsTrigger>
              <TabsTrigger value="programs"><Code className="h-4 w-4 mr-2" />Programs</TabsTrigger>
            </TabsList>
          </div>
          <div className="p-4">
            <TabsContent value="transactions">
              <TransactionManager 
                transactions={app.transactions}
                onUpdate={(newTransactions) => onUpdate({ ...app, transactions: newTransactions })}
              />
            </TabsContent>
            <TabsContent value="features">
              <FeatureManager
                features={app.features}
                onUpdate={(newFeatures) => onUpdate({ ...app, features: newFeatures })}
              />
            </TabsContent>
            <TabsContent value="programs">
              <ProgramManager
                programs={app.programs}
                features={app.features}
                onUpdate={(newPrograms) => onUpdate({ ...app, programs: newPrograms })}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
