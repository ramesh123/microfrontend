import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getNodeDetails } from '@/controllers/API/datasetApi';
import { NodeDetails } from '@/types/dataset';
import { Skeleton } from '@/components/ui/skeleton';
import { ForwardedIconComponent } from '@/components/common/genericIconComponent';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import DatasetSidebarList from '@/components/common/datasets/DatasetSideBarList';
import DynamicDatasetForm from '@/components/common/datasets/DynamicDatasetForm';

const CreateDatasetPage = () => {
    const { nodeId } = useParams<{ nodeId: string }>();
    const navigate = useNavigate();
    const [nodeDetails, setNodeDetails] = useState<NodeDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        if (nodeId) {
            setIsLoading(true);
            getNodeDetails(nodeId)
                .then(setNodeDetails)
                .catch(console.error)
                .finally(() => setIsLoading(false));
        }
    }, [nodeId]);
    
    const handleSuccess = () => {
        setRefreshKey(prev => prev + 1);
    }

    if (isLoading) {
        return (
            <div className="flex flex-col h-[calc(100vh-2rem)] p-4 gap-4">
                 <Skeleton className="h-10 w-full" />
                 <div className="flex-grow flex gap-4 overflow-hidden">
                    <div className="w-[30%]"><Skeleton className="h-full w-full" /></div>
                    <div className="w-[70%]"><Skeleton className="h-full w-full" /></div>
                 </div>
            </div>
        );
    }

    if (!nodeDetails) {
        return <div>Error: Could not load connector details.</div>;
    }

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            <header className="flex-shrink-0 flex items-center gap-4 py-3 border-b mb-4">
                <Button variant="ghost" onClick={() => navigate('/dashboard/datasets-cards')} className="pr-4">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
                <div className="flex items-center gap-3">
                    <div className="bg-card p-2 rounded-lg border">
                        <ForwardedIconComponent name={nodeDetails.icon} className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Create {nodeDetails.display_name}</h1>
                        <p className="text-sm text-muted-foreground">{nodeDetails.group} Dataset</p>
                    </div>
                </div>
            </header>
            {/* <div className="flex gap-6 mr-2">
                <aside className="w-[30%] h-full">
                    <DatasetSidebarList key={refreshKey} nodeType={nodeDetails.name} />
                </aside>
                <main className="w-[70%] h-full">
                    <DynamicDatasetForm 
                        nodeDetails={nodeDetails} 
                        onSuccess={handleSuccess}
                    />
                </main>
            </div> */}
        </div>
    );
};

export default CreateDatasetPage;
