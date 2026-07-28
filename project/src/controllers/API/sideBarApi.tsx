import { NodesApiResponse, DatasetsApiResponse } from '@/types/nodeSideBar';
import api from './api'

export const nodesApi = {
  getNodesList: async (): Promise<NodesApiResponse> => {
    const response = await api.post('/nodes/get-nodes-list', {});
    return response.data;
  },
};

export const datasetsApi = {
  getAllDatasets: async (): Promise<DatasetsApiResponse> => {
    const response = await api.get('/dataset');
    return response.data;
  },
};

export default api;
