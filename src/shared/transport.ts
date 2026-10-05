import type { Backend, BackendEvent, Connection, Message } from './contract';

/** Session API — управление сессией пользователя */
export interface SessionApi {
  userId: string;
  sessionId: string;
  isActive: boolean;
  close(): void;
}

/** Transport — адаптер Backend для работы в контексте сессии */
export interface Transport {
  backend: Backend;
  session: SessionApi;
  connect(): void;
  loadHistory(beforeId?: string): Promise<{ messages: Message[]; hasMore: boolean }>;
  send(clientId: string, text: string): Promise<Message>;
  on(listener: (e: BackendEvent) => void): () => void;
  dispose(): void;
}

/**
 * Создаёт SessionApi — управляет сессией пользователя
 */
export function createSession(): SessionApi {
  const userId = `user-${Math.random().toString(36).slice(2, 9)}`;
  const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  let isActive = true;

  return {
    userId,
    sessionId,
    get isActive() {
      return isActive;
    },
    close() {
      isActive = false;
    },
  };
}

/**
 * Создаёт Transport — адаптирует Backend для работы с сессией
 */
export function createTransport(backend: Backend): Transport {
  const session = createSession();
  const listeners: ((e: BackendEvent) => void)[] = [];
  let disposed = false;

  const unsubscribe = backend.on((event) => {
    if (!disposed && session.isActive) {
      listeners.forEach((fn) => fn(event));
    }
  });

  return {
    backend,
    session,

    connect() {
      if (session.isActive) {
        backend.connect();
      }
    },

    loadHistory(beforeId?: string) {
      if (!session.isActive) {
        return Promise.reject(new Error('session closed'));
      }
      return backend.loadHistory(beforeId);
    },

    send(clientId: string, text: string) {
      if (!session.isActive) {
        return Promise.reject(new Error('session closed'));
      }
      return backend.send(clientId, text);
    },

    on(listener: (e: BackendEvent) => void) {
      listeners.push(listener);
      return () => {
        const idx = listeners.indexOf(listener);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    },

    dispose() {
      disposed = true;
      session.close();
      unsubscribe();
      listeners.length = 0;
    },
  };
}
