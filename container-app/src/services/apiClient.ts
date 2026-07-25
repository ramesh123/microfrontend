import axios from "axios";

/**
 * Common API client for container-owned pages (e.g. the MFE-unavailable /
 * landing views). workflow-app keeps using its own existing
 * controllers/API/* clients unchanged — this does not replace those.
 */
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "",
  timeout: 30_000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("auth-token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("[container-app] API error:", error?.message ?? error);
    return Promise.reject(error);
  },
);
