// hooks/useApiCrud.ts
import { useState, useCallback } from "react";

interface ApiState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
}

interface CrudFunctions<T> {
  getAll: () => Promise<T[]>;
  getOne?: (id: string) => Promise<T>;
  createApi?: (payload: Partial<T>) => Promise<T>;
  update?: (payload: Partial<T>) => Promise<T>;
  remove?: (id: string) => Promise<void>;
}

export function useApiCrud<T>(apiFns: CrudFunctions<T>) {
  const [state, setState] = useState<ApiState<T>>({
    data: [],
    loading: false,
    error: null,
  });

  const safeCall = useCallback(async <R>(fn: () => Promise<R>): Promise<R | null> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await fn();
      setState((prev) => ({ ...prev, loading: false }));
      return result;
    } catch (error: any) {
      setState((prev) => ({ ...prev, loading: false, error: error.message || "Unknown error" }));
      return null;
    }
  }, []);

  const normalizeListPayload = (payload: unknown): any[] => {
    if (Array.isArray(payload)) return payload;
    if (payload && typeof payload === "object" && Array.isArray((payload as any).data)) {
      return (payload as any).data;
    }
    return [];
  };

  const loadAll = useCallback(async () => {
    if (!apiFns.getAll) return;
    const data: any = await safeCall(apiFns.getAll);
    if (data != null) {
      setState({ data: normalizeListPayload(data), loading: false, error: null });
    }
    return data;
  }, [apiFns.getAll, safeCall]);

  const orgAll = useCallback(async () => {
    if (!apiFns.getAll) return;
    const data: any = await safeCall(apiFns.getAll);
    if (data != null) {
      setState({ data: normalizeListPayload(data), loading: false, error: null });
    }
    return data;
  }, [apiFns.getAll, safeCall]);

  const createApi = useCallback(async (payload: Partial<T>) => {
    if (!apiFns.createApi) return;
    const newItem = await safeCall(() => apiFns.createApi!(payload));
    if (newItem) {
      setState((prev) => ({ ...prev, data: [...prev.data, newItem] }));
    }
    return newItem;
  }, [apiFns.createApi, safeCall]);

  const update = useCallback(async (id: string, payload: Partial<T>) => {
    if (!apiFns.update) return;
    const updated = await safeCall(() => apiFns.update!(payload));
    if (updated) {
      setState((prev) => ({
        ...prev,
        data: prev.data.map((item: any) => (item.id === id ? updated : item)),
      }));
    }
    return updated;
  }, [apiFns.update, safeCall]);

  const remove = useCallback(async (id: string) => {
    if (!apiFns.remove) return;
    await safeCall(() => apiFns.remove!(id));
    // always refresh after delete
    return loadAll();
  }, [apiFns.remove, loadAll, safeCall]);

  return {
    ...state,
    loadAll,
    createApi,
    update,
    remove,
  };
}
