import { useEffect, useRef, useState, useCallback } from 'react';

export type EventSourceStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'closed';

export interface UseEventSourceOptions<T> {
  /** SSE endpoint URL. Pass null to disable. */
  url: string | null;
  /** Whether the connection should be active. Default: true */
  enabled?: boolean;
  /** Called for each parsed message */
  onMessage?: (data: T) => void;
  /** Called on connection error */
  onError?: (error: Event) => void;
  /** Auto-reconnect on disconnect. Default: true */
  reconnect?: boolean;
  /** Max reconnect attempts. Default: 5 */
  maxRetries?: number;
  /** Delay between reconnects in ms. Default: 2000 */
  retryDelay?: number;
}

export interface UseEventSourceReturn<T> {
  /** All received events */
  events: T[];
  /** Most recent event */
  lastEvent: T | null;
  /** Connection status */
  status: EventSourceStatus;
  /** Manually close connection */
  close: () => void;
  /** Manually reconnect */
  reconnect: () => void;
  /** Clear accumulated events */
  clear: () => void;
}

export function useEventSource<T = unknown>(options: UseEventSourceOptions<T>): UseEventSourceReturn<T> {
  const {
    url,
    enabled = true,
    onMessage,
    onError,
    reconnect: shouldReconnect = true,
    maxRetries = 5,
    retryDelay = 2000,
  } = options;

  const [events, setEvents] = useState<T[]>([]);
  const [lastEvent, setLastEvent] = useState<T | null>(null);
  const [status, setStatus] = useState<EventSourceStatus>('idle');

  const esRef = useRef<EventSource | null>(null);
  const retriesRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep callbacks in refs to avoid re-triggering effects
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  onMessageRef.current = onMessage;
  onErrorRef.current = onError;

  const closeConnection = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!url) return;

    closeConnection();
    setStatus('connecting');

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      setStatus('connected');
      retriesRef.current = 0;
    };

    es.onmessage = (event: MessageEvent) => {
      // Skip heartbeat-only lines (EventSource API won't fire for comments,
      // but if the server sends data with heartbeat content, filter it)
      if (!event.data || event.data.trim() === '') return;

      try {
        const parsed = JSON.parse(event.data) as T;
        setEvents((prev) => [...prev, parsed]);
        setLastEvent(parsed);
        onMessageRef.current?.(parsed);
      } catch {
        // Non-JSON data — ignore (heartbeat, keep-alive, etc.)
      }
    };

    es.onerror = (err) => {
      onErrorRef.current?.(err);

      // EventSource auto-reconnects for some errors, but if readyState is CLOSED
      // we need to handle it ourselves
      if (es.readyState === EventSource.CLOSED) {
        setStatus('error');
        esRef.current = null;

        if (shouldReconnect && retriesRef.current < maxRetries) {
          retriesRef.current += 1;
          retryTimerRef.current = setTimeout(() => {
            connect();
          }, retryDelay);
        } else if (retriesRef.current >= maxRetries) {
          setStatus('closed');
        }
      }
    };
  }, [url, closeConnection, shouldReconnect, maxRetries, retryDelay]);

  // Connect / disconnect based on url + enabled
  useEffect(() => {
    if (!url || !enabled) {
      closeConnection();
      setStatus('idle');
      return;
    }

    connect();

    return () => {
      closeConnection();
    };
  }, [url, enabled, connect, closeConnection]);

  const manualReconnect = useCallback(() => {
    retriesRef.current = 0;
    connect();
  }, [connect]);

  const clear = useCallback(() => {
    setEvents([]);
    setLastEvent(null);
  }, []);

  const manualClose = useCallback(() => {
    closeConnection();
    setStatus('closed');
  }, [closeConnection]);

  return {
    events,
    lastEvent,
    status,
    close: manualClose,
    reconnect: manualReconnect,
    clear,
  };
}
