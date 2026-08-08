import axios, { AxiosInstance } from "axios";

// Legacy API base URL
export const API_BASE_URL = '/api';

// DataFusion v2 API base URL
export const API_V2_BASE_URL = '/api/v2';

// Legacy API instance
// withCredentials is required so session cookies from /users/login
// are stored and sent on later same-origin /api calls (e.g. /session/me).
const api: AxiosInstance = axios.create({ 
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 
    'Content-Type': 'application/json',
  },
});

// DataFusion v2 API instance
export const apiV2: AxiosInstance = axios.create({ 
  baseURL: API_V2_BASE_URL,
  withCredentials: true,
  headers: { 
    'Content-Type': 'application/json',
  },
});

export default api;

