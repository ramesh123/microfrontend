import { saveAs } from 'file-saver';
import api from './api';
import { assertBlobNotApiError, rethrowApiError } from '@/utils/exceptionHelper';

/**
 * Calls the backend API using api to fetch a stored document and triggers a download.
 * The file path is sent as a query parameter.
 */
export const downloadStoredDocument = async (path: string): Promise<void> => {
  if (!path || typeof path !== 'string') {
    throw new Error('Invalid file path provided for download.');
  }

  const fallbackMessage = 'Failed to download document';

  try {
    const response = await api.post(
      '/files/stored-document',
      null,
      {
        params: { file_path: path },
        headers: { 'Content-Type': 'application/json' },
        responseType: 'blob',
      },
    );

    const blob = response.data as Blob;
    await assertBlobNotApiError(blob, fallbackMessage);

    const fileName = path.split('/').pop() || 'downloaded-file';
    saveAs(blob, fileName);
  } catch (error) {
    console.error('Download service error:', error);
    await rethrowApiError(error, fallbackMessage);
  }
};
