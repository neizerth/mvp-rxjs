import type { StoreApi } from 'zustand';
import type { Message } from '../../shared/contract';
import type { Transport } from '../../shared/transport';

interface AppState {
  messages: Message[];
  failedMessages: Set<string>;
  pendingMessages: Map<string, Message>;
  connection: string;
}

export function createSendProcess(deps: {
  store: StoreApi<AppState>;
  transport: Transport;
}) {
  const { store, transport } = deps;
  const activeRequests = new Map<string, ReturnType<typeof setTimeout>>();

  const processSend = (clientId: string, text: string) => {
    const timeoutId = setTimeout(() => {
      const s = store.getState();
      if (s.pendingMessages.has(clientId)) {
        const failed = new Set(s.failedMessages);
        failed.add(clientId);
        store.setState({
          ...s,
          failedMessages: failed,
        });
      }
      activeRequests.delete(clientId);
    }, 10000);

    activeRequests.set(clientId, timeoutId);

    transport.send(clientId, text).then(
      () => {
        // Message will come through backend.on() - receive handler will update it
        clearTimeout(timeoutId);
        activeRequests.delete(clientId);
      },
      (error) => {
        if (error.message !== 'offline') {
          clearTimeout(timeoutId);
          const s = store.getState();
          const failed = new Set(s.failedMessages);
          failed.add(clientId);
          store.setState({
            ...s,
            failedMessages: failed,
          });
          activeRequests.delete(clientId);
        }
      }
    );
  };

  const unsubBackend = transport.backend.on((event) => {
    const s = store.getState();
    if (event.type === 'connection' && event.state === 'connected') {
      s.pendingMessages.forEach((msg, clientId) => {
        if (!s.failedMessages.has(clientId) && !activeRequests.has(clientId)) {
          processSend(clientId, msg.text);
        }
      });
    }
  });

  // Store reference to processSend for manual sends from useChat
  (deps.store as any).__processSend = processSend;

  return {
    unsubscribe() {
      unsubBackend();
      activeRequests.forEach((t) => clearTimeout(t));
      activeRequests.clear();
    },
  };
}
