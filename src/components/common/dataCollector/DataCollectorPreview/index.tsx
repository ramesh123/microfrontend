import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, CheckCircle2, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { downloadStoredDocument } from '@/controllers/API/dataCollectorAPI';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';

// Defines the expected structure of the API response for the data_collector node
interface DataCollectorResponse {
  status: boolean;
  message: string;
  data?: { // Inner data is optional for robustness
    status: boolean;
    message: string;
    data: string[];
  };
}

interface DataCollectorPreviewProps {
  response: DataCollectorResponse;
}

const DataCollectorPreview: React.FC<DataCollectorPreviewProps> = ({ response }) => {
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  // Helper function to extract the filename from a full path
  const getFileName = (path: string) => path.split('/').pop() || path;

  const handleDownload = async (path: string) => {
    const fileName = getFileName(path);
    setDownloadingFile(path);
    const toastId = toast.loading(`Downloading ${fileName}...`);

    try {
      await downloadStoredDocument(path);
      toast.success(`Download for ${fileName} started successfully.`, { id: toastId });
    } catch (error) {
      toast.error(`Failed to download ${fileName}.`, {
        id: toastId,
        description: getDisplayErrorMessage(error, 'Download failed'),
      });
    } finally {
      setDownloadingFile(null);
    }
  };

  // Safely access the list of file paths and messages
  const filePaths = response?.data?.data || [];
  const overallMessage = response?.message || "Execution completed.";
  const detailsMessage = response?.data?.message || "Generated files are listed below.";

  return (
    <div className="h-full w-full p-4 flex flex-col items-center justify-center">
      <Card className="w-full p-0 gap-2">
        <CardHeader className="p-2">
          <CardTitle className="flex items-center gap-2 p-0">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
            {overallMessage}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3 p-0">
          {filePaths.length > 0 ? (
            <div className="p-3 bg-muted rounded-md border space-y-2">
              <p className="text-sm font-semibold">{detailsMessage}</p>
              <ul className="space-y-2">
                {filePaths.map((path, index) => (
                  <li key={index} className="flex items-center justify-between gap-3 p-2 rounded-md bg-background border">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm font-mono truncate" title={path}>{getFileName(path)}</span>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleDownload(path)}
                      disabled={downloadingFile === path}
                    >
                      {downloadingFile === path ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      {downloadingFile === path ? 'Downloading...' : 'Download'}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-10">
              {/* No output files were generated. */}
              </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DataCollectorPreview;
