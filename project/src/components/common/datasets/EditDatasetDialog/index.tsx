// // src/components/common/datasets/EditDatasetDialog/index.tsx
// import { useEffect, useState } from 'react';
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
// import { getDatasetById, updateDataset } from '@/controllers/API/datasetApi';
// import { Dataset, NodeDetails } from '@/types/dataset';
// import { Skeleton } from '@/components/ui/skeleton';
// import DynamicDatasetForm from '../DynamicDatasetForm';
// import { toast } from 'sonner';

// interface EditDatasetDialogProps {
//     datasetId: number;
//     onClose: () => void;
//     onSuccess: () => void; // To refresh the list
// }

// const EditDatasetDialog = ({ datasetId, onClose, onSuccess }: EditDatasetDialogProps) => {
//     const [dataset, setDataset] = useState<Dataset | null>(null);
//     const [isLoading, setIsLoading] = useState(true);
//     const [nodeDetails, setNodeDetails] = useState<NodeDetails | null>(null);

//     useEffect(() => {
//         getDatasetById(datasetId)
//             .then(data => {
//                 if (!data.template) {
//                   throw new Error("Dataset template is missing. Cannot edit.");
//                 }
//                 setDataset(data);
//                 // Reconstruct a partial NodeDetails from dataset info for the form
//                 // FIX: Removed `node_id` and `description` to match the NodeDetails type.
//                 // The `name` property should represent the connector type (e.g., 'postgresql').
//                 setNodeDetails({
//                     display_name: data.dataset_type,
//                     group: data.dataset_group,
//                     icon: data.dataset_type, 
//                     name: data.dataset_type, // This should be the type, not the instance name
//                     type: data.dataset_group,
//                     node: {
//                         template: data.template,
//                         payload: data.payload,
//                         // get_data is not used in the edit form, so a placeholder is fine.
//                         get_data: { module: '', klass: '', method: '' } 
//                     }
//                 });
//             })
//             .catch(err => {
//                 toast.error(err.message || "Failed to load dataset details.");
//                 console.error(err);
//                 onClose();
//             })
//             .finally(() => setIsLoading(false));
//     }, [datasetId, onClose]);

//     const handleUpdate = async (formData: Record<string, any>) => {
//         if (!dataset) return;
        
//         const { datasetName, ...payloadData } = formData;

//         // The payload for the update API should not contain the datasetName itself
//         delete payloadData.datasetName;

//         const submissionData = {
//             name: datasetName,
//             dataset_type: dataset.dataset_type,
//             dataset_group: dataset.dataset_group,
//             payload: payloadData,
//             template: dataset.template,
//         };

//         try {
//             await updateDataset(datasetId, submissionData);
//             toast.success("Dataset updated successfully!");
//             onSuccess(); // This will trigger the list refresh and close the dialog
//         } catch (error) {
//             // Error is already toasted by the API handler
//         }
//     };

//     return (
//         <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
//             <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0">
//                 <DialogHeader className="p-6 pb-4">
//                     <DialogTitle>Edit Dataset: {dataset?.name || '...'}</DialogTitle>
//                     <DialogDescription>
//                         Modify the configuration for this dataset.
//                     </DialogDescription>
//                 </DialogHeader>
//                 <div className="flex-grow overflow-hidden">
//                 {isLoading || !nodeDetails ? (
//                     <div className="p-6">
//                         <Skeleton className="h-[400px] w-full" />
//                     </div>
//                 ) : ( 
//                     <DynamicDatasetForm
//                         nodeDetails={nodeDetails}
//                         datasetIdToEdit={datasetId}
//                         initialData={dataset?.payload || null}
//                         onSuccess={handleUpdate}
//                         onCancel={onClose}
//                         isEditing={true}
//                     />
//                 )}
//                 </div>
//             </DialogContent>
//         </Dialog>
//     );
// };

// export default EditDatasetDialog;