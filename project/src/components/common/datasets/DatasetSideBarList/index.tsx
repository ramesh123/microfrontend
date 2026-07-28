// src/components/common/datasets/DatasetSideBarList/index.tsx
import { useEffect, useState } from 'react';
import { getDatasetsForType } from '@/controllers/API/datasetApi';
import { DatasetListItem } from '@/types/dataset';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { ForwardedIconComponent } from '../../genericIconComponent';
import { Button } from '@/components/ui/button';

interface DatasetSidebarListProps {
    nodeType: string;
    onSelectDataset: (datasetId: number) => void;
}

const DatasetSidebarList = ({ nodeType, onSelectDataset }: DatasetSidebarListProps) => {
    const [datasets, setDatasets] = useState<DatasetListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (nodeType) {
            setIsLoading(true);
            getDatasetsForType({ dataset_type: nodeType })
                .then(response => {
                    setDatasets(response.data || []);
                })
                .catch(error => {
                    console.error(error);
                    toast.error(getDisplayErrorMessage(error, 'Failed to load existing datasets.'));
                    setDatasets([]);
                })
                .finally(() => setIsLoading(false));
        }
    }, [nodeType]);

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="flex-shrink-0">
                <div className="flex items-center gap-2">
                    <ForwardedIconComponent name="Database" className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">Existing Datasets ({isLoading ? '...' : datasets.length})</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="flex-grow overflow-y-auto pr-2">
                {isLoading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)}
                    </div>
                ) : datasets.length > 0 ? (
                    <ul className="space-y-2">
                        {datasets.map(dataset => (
                            <li 
                                key={dataset.value} 
                                className="text-sm p-2 rounded-md border bg-background hover:bg-accent flex items-center gap-2"
                            >
                                <span className="flex-grow truncate font-medium">{dataset.label}</span>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7 flex-shrink-0"
                                    onClick={() => onSelectDataset(dataset.value)}
                                    title={`Edit ${dataset.label}`}
                                >
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                        <Database className="h-12 w-12 mb-4" />
                        <p className="font-semibold">No existing datasets</p>
                        <p className="text-xs">Create your first dataset using the form.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default DatasetSidebarList;
