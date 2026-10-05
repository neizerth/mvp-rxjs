import type { StoreApi } from 'zustand';
import type { Message } from '../../shared/contract';
import type { Transport } from '../../shared/transport';

interface AppState {
  pendingMessages: Map<string, Message>;
}

export function createOutboxProcess(deps: {
  store: StoreApi<AppState>;
  transport: Transport;
}) {
  const { store, transport } = deps;

  const unsubBackend = transport.backend.on((event) => {
    if (event.type === 'connection' && event.state === 'connected') {
      const s = store.getState();
      const processSend = (deps.store as any).__processSend;
      if (processSend) {
        s.pendingMessages.forEach((msg, clientId) => {
          processSend(clientId, msg.text);
        });
      }
    }
  });

  return {
    unsubscribe() {
      unsubBackend();
    },
  };
}
