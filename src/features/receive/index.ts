import type { StoreApi } from 'zustand';
import type { Message } from '../../shared/contract';
import type { Transport } from '../../shared/transport';

interface AppState {
  messages: Message[];
  pendingMessages: Map<string, Message>;
  failedMessages: Set<string>;
}

export function createReceiveProcess(deps: {
  store: StoreApi<AppState>;
  transport: Transport;
}) {
  const { store, transport } = deps;

  const unsubBackend = transport.backend.on((event) => {
    if (event.type === 'message') {
      const s = store.getState();
      const existing = s.messages.find((m) => m.id === event.message.id);
      if (existing) return;

      let msgs = [...s.messages];
      let pending = new Map(s.pendingMessages);
      let failed = new Set(s.failedMessages);

      if (event.message.clientId && s.pendingMessages.has(event.message.clientId)) {
        // Replace pending with server response
        const idx = msgs.findIndex((m) => m.clientId === event.message.clientId);
        if (idx >= 0) {
          msgs[idx] = event.message;
        }
        pending.delete(event.message.clientId);
        failed.delete(event.message.clientId);
      } else {
        // New incoming message
        msgs.push(event.message);
      }

      msgs.sort((a, b) =>
        a.createdAt !== b.createdAt
          ? a.createdAt - b.createdAt
          : a.id.localeCompare(b.id)
      );

      store.setState({
        ...s,
        messages: msgs,
        pendingMessages: pending,
        failedMessages: failed,
      });
    }
  });

  return {
    unsubscribe() {
      unsubBackend();
    },
  };
}
